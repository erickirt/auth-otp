---
"@perseidesjs/auth-otp": patch
---

fix(C1): guard undefined entityId in getAuthIdentityStep to prevent MikroORM full-table scan
