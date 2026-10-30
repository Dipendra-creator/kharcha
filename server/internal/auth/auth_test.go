package auth

import (
	"bytes"
	"testing"
)

func TestTokensRoundTrip(t *testing.T) {
	tk := Tokens{Secret: []byte("test-secret")}
	token, err := tk.Issue("user-1")
	if err != nil {
		t.Fatal(err)
	}
	if id, err := tk.Verify(token); err != nil || id != "user-1" {
		t.Fatalf("got %q, %v", id, err)
	}
	if _, err := (Tokens{Secret: []byte("other")}).Verify(token); err == nil {
		t.Fatal("token verified with the wrong secret")
	}
}

func TestSealer(t *testing.T) {
	s, err := NewSealer(bytes.Repeat([]byte{7}, 32))
	if err != nil {
		t.Fatal(err)
	}
	sealed, _ := s.Seal([]byte("1//refresh-token"))
	if bytes.Contains(sealed, []byte("refresh")) {
		t.Fatal("plaintext visible")
	}
	plain, err := s.Open(sealed)
	if err != nil || string(plain) != "1//refresh-token" {
		t.Fatalf("got %q, %v", plain, err)
	}
	sealed[len(sealed)-1] ^= 1
	if _, err := s.Open(sealed); err == nil {
		t.Fatal("tampered ciphertext opened")
	}
}
