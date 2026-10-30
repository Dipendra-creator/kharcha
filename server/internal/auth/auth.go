// Package auth issues and verifies Kharcha session tokens and checks Google ID tokens.
package auth

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const sessionTTL = 90 * 24 * time.Hour

type Tokens struct{ Secret []byte }

func (t Tokens) Issue(userID string) (string, error) {
	now := time.Now()
	return jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Subject:   userID,
		Issuer:    "kharcha",
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(sessionTTL)),
	}).SignedString(t.Secret)
}

// Verify returns the user id of a valid session token.
func (t Tokens) Verify(token string) (string, error) {
	claims := &jwt.RegisteredClaims{}
	_, err := jwt.ParseWithClaims(token, claims, func(*jwt.Token) (any, error) { return t.Secret, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithIssuer("kharcha"))
	if err != nil {
		return "", err
	}
	if claims.Subject == "" {
		return "", errors.New("token has no subject")
	}
	return claims.Subject, nil
}

// GoogleIdentity is the verified part of a Google ID token.
type GoogleIdentity struct {
	Email string
	Name  string
}

// VerifyGoogleIDToken checks a Google ID token with Google's tokeninfo
// endpoint and requires its audience to be one of our OAuth client ids.
func VerifyGoogleIDToken(ctx context.Context, idToken string, audiences []string) (GoogleIdentity, error) {
	if len(audiences) == 0 {
		return GoogleIdentity{}, errors.New("GOOGLE_CLIENT_IDS is not configured")
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://oauth2.googleapis.com/tokeninfo?id_token="+url.QueryEscape(idToken), nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return GoogleIdentity{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return GoogleIdentity{}, fmt.Errorf("google rejected the ID token (%d)", resp.StatusCode)
	}
	var info struct {
		Aud           string `json:"aud"`
		Iss           string `json:"iss"`
		Email         string `json:"email"`
		EmailVerified string `json:"email_verified"`
		Name          string `json:"name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return GoogleIdentity{}, err
	}
	if !slices.Contains(audiences, info.Aud) {
		return GoogleIdentity{}, errors.New("ID token was issued for another app")
	}
	if info.Iss != "accounts.google.com" && info.Iss != "https://accounts.google.com" {
		return GoogleIdentity{}, errors.New("ID token has an unexpected issuer")
	}
	if info.EmailVerified != "true" || info.Email == "" {
		return GoogleIdentity{}, errors.New("Google account email is not verified")
	}
	return GoogleIdentity{Email: info.Email, Name: info.Name}, nil
}

// Sealer encrypts secrets at rest with AES-256-GCM.
type Sealer struct{ aead cipher.AEAD }

func NewSealer(key []byte) (*Sealer, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Sealer{aead: aead}, nil
}

func (s *Sealer) Seal(plain []byte) ([]byte, error) {
	nonce := make([]byte, s.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return s.aead.Seal(nonce, nonce, plain, nil), nil
}

func (s *Sealer) Open(sealed []byte) ([]byte, error) {
	n := s.aead.NonceSize()
	if len(sealed) < n {
		return nil, errors.New("ciphertext too short")
	}
	return s.aead.Open(nil, sealed[:n], sealed[n:], nil)
}
