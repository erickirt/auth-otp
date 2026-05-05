---
"@perseidesjs/auth-otp": minor
---

fix(C2): OTP is now invalidated after successful verify — prevents replay attacks

BREAKING: validateOtpStep now throws on invalid OTP instead of returning { isValid: false }.
verifyOtpWorkflow response no longer includes the isValid field.
