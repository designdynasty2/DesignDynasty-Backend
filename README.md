# Auth OTP Project

## Setup
1. Copy `.env.example` to `.env` and fill SMTP + JWT configurations.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development:
   ```bash
   npm run dev
   ```

## API
- POST `/auth/register` { name, email, mobile }
  - Sends 6-digit OTP to email, valid 5 minutes.
- POST `/auth/verify-otp` { email, mobile, otp }
  - If valid, creates user and emails a generated password.
- POST `/auth/login` { email, password }
  - Returns JWT token.

## Notes
- Uses NeDB (file DB in `db/` folder) for quick start.
- For production, replace with a real DB and add rate limiting.