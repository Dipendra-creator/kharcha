package redact

import (
	"strings"
	"testing"
)

func TestText(t *testing.T) {
	in := "OTP is 482913. A/c 123456781234 debited Rs 500 to 9876543210@ybl, call +91 9988776655 or mail a.b@gmail.com. PAN ABCDE1234F. UPI Ref 430312345678"
	out := Text(in)
	for _, leaked := range []string{"482913", "123456781234", "9876543210", "9988776655", "a.b@gmail.com", "ABCDE1234F"} {
		if strings.Contains(out, leaked) {
			t.Errorf("leaked %q in %q", leaked, out)
		}
	}
	for _, kept := range []string{"XX1234", "430312345678", "[phone]@ybl", "Rs 500"} {
		if !strings.Contains(out, kept) {
			t.Errorf("expected %q in %q", kept, out)
		}
	}
}

func TestSignatureGroupsTemplates(t *testing.T) {
	a := Signature("Rs.250.00 debited from A/c XX1234 on 30-10-26 to VPA swiggy@icici (UPI Ref No 430312345680)")
	b := Signature("Rs.612.50 debited from A/c XX1234 on 29-10-26 to VPA swiggy@icici (UPI Ref No 430312345999)")
	if a != b {
		t.Fatalf("same template, different signatures:\n%s\n%s", a, b)
	}
}
