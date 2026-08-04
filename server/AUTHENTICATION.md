# SupportPilot sign-in module

## Request flow

1. `POST /api/auth/sign-in` reaches `routes/authRoutes.js`.
2. `middleware/validateRequest.js` rejects malformed email/password input.
3. `controllers/authController.js` passes normalized input to the service.
4. `services/authService.js` retrieves the user and calls `bcrypt.compare()`.
5. `models/userModel.js` uses a parameterized join between `users` and `roles`.
6. `utils/token.js` creates a signed, expiring JWT.
7. `utils/authCookie.js` writes it to an HTTP-only cookie.
8. `middleware/authenticate.js` verifies that cookie on protected routes.

The JWT is deliberately omitted from the JSON response, which prevents
frontend JavaScript from reading it.

## Endpoints

### Sign in

```http
POST /api/auth/sign-in
Content-Type: application/json

{
  "email": "agent@supportpilot.com",
  "password": "your-password"
}
```

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
  body: JSON.stringify({ email, password }),
});
```

## Production settings

- Replace `JWT_SECRET` with a cryptographically random secret.
- Set `JWT_COOKIE_SECURE=true` behind HTTPS.
- Set `CLIENT_ORIGIN` to the exact frontend origin.
- Keep `SameSite=Lax` or `Strict` when the deployment allows it.
- If cross-site cookies require `SameSite=None`, keep `Secure=true` and add
  CSRF-token protection to all state-changing authenticated routes.
- Apply login rate limiting at the API gateway or with a shared store such as
  Redis when running multiple server instances.

