# SupportPilot sign-in module

## Request flow

1. `POST /api/auth/sign-in` reaches `routes/authRoutes.js`.
2. `middleware/validateRequest.js` rejects invalid account types or credentials.
3. `controllers/authController.js` passes normalized input to the service.
4. `services/authService.js` selects exactly one account source from `accountType`.
5. Individual sign-in queries `users` and excludes records linked through `company_admins`.
6. Company sign-in starts from `companies.business_email`, joins its single
   `company_admins` record, and verifies the linked user's bcrypt password.
7. The service never falls back to the other account source.
8. `utils/token.js` creates a signed JWT containing `accountType` and the
   appropriate user/company identifiers.
9. `utils/authCookie.js` writes it to an HTTP-only cookie.
10. `middleware/authenticate.js` verifies that cookie on protected routes.

The JWT is deliberately omitted from the JSON response, which prevents
frontend JavaScript from reading it.

## Endpoints

### Sign in

```http
POST /api/auth/sign-in
Content-Type: application/json

{
  "accountType": "individual",
  "email": "agent@supportpilot.com",
  "password": "your-password"
}
```

For company sign-in, use the company's `business_email` rather than the linked
administrator's user email:

```http
POST /api/auth/sign-in
Content-Type: application/json

{
  "accountType": "company",
  "email": "support@company.com",
  "password": "the-linked-company-admin-password"
}
```

Allowed account types are exactly `individual` and `company`.

### Automatic company registration

```http
POST /api/auth/company/register
Content-Type: application/json

{
  "companyName": "Acme Support",
  "industry": "SaaS",
  "businessEmail": "contact@acme.example",
  "phone": "+1 555 012 3456",
  "website": "https://acme.example",
  "description": "Customer support software",
  "adminFirstName": "Alex",
  "adminLastName": "Morgan",
  "adminEmail": "admin@acme.example",
  "password": "your-password"
}
```

Business and administrator emails are separate identities. Registration creates
an Active company, an Active user with the existing `Company Admin` role, and
the `company_admins` relationship in one transaction. A successful response
sets the same HTTP-only authentication cookie used by sign-in. Password
confirmation is client-only and must not be included in the API payload.

### Current session

```http
GET /api/auth/me
```

### Sign out

```http
POST /api/auth/sign-out
```

The browser must send requests with credentials enabled:

```js
fetch("http://localhost:5000/api/auth/sign-in", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ accountType, email, password }),
});
```

The `/api/auth/me` response includes `accountType`. Company sessions also
include `companyId` and `companyName`. Use `requireAccountType("company")` or
`requireAccountType("individual")` after `authenticate` on portal-specific
backend routes.

## Production settings

- Replace `JWT_SECRET` with a cryptographically random secret.
- Set `JWT_COOKIE_SECURE=true` behind HTTPS.
- Set `CLIENT_ORIGIN` to the exact frontend origin.
- Keep `SameSite=Lax` or `Strict` when the deployment allows it.
- If cross-site cookies require `SameSite=None`, keep `Secure=true` and add
  CSRF-token protection to all state-changing authenticated routes.
- Apply login rate limiting at the API gateway or with a shared store such as
  Redis when running multiple server instances.
