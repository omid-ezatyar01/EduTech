# EduTech Backend

This backend now supports a unified payment architecture for:

- `HESABPAY_HOSTED`
- `USDT_BSC_DIRECT`
- `NOWPAYMENTS_CRYPTO`

The commercial course price remains authoritative in `USD` on the course record. The frontend currently presents that price as `USDT` for student checkout. Payment-specific quoting happens only when creating a payment attempt.

## Stack

- Runtime: Node.js ESM
- HTTP framework: Express
- Database: MongoDB
- ORM/ODM: Mongoose
- Payments:
  - HesabPay hosted checkout
  - Direct `USDT` on `BSC (BEP20)` for low-price courses
  - NOWPayments on the BSC network for hosted crypto checkout

## Payment Model

The backend separates the commercial order from provider-specific payment attempts.

### Order

- One pending commercial order per `userId + courseId`
- Stores `baseAmountUsdCents`
- Status flow: `PENDING -> PAID`

### PaymentAttempt

- One record per checkout attempt
- Stores provider quote snapshot and audit metadata
- Supports:
  - `PENDING`
  - `SUCCEEDED`
  - `FAILED`
  - `EXPIRED`
  - `DUPLICATE_PAYMENT`
  - `MANUAL_REVIEW`

## Currency Rules

- Course records stay `USD` only
- USD values are normalized into integer cents for order and attempt bookkeeping
- HesabPay:
  - backend converts USD cents to AFN
  - exact AFN amount, exchange rate, source, and retrieval time are stored on the attempt
  - international card conversions inside HesabPay are not recalculated by this app
- Crypto checkout:
  - the course record stays priced in `USD`
  - the student-facing crypto price is shown as the same numeric value in `USDT`
  - no AFN conversion is involved
  - sender must pay only on `BSC (BEP20)`
  - the backend chooses the crypto flow by price:
    - `< 12.00 USD`: direct `USDT` on BSC
    - `>= 12.00 USD`: hosted NOWPayments checkout

## Crypto Pricing Rule

- Course card / course page:
  - shown to students as `USDT`
- Hosted crypto checkout through NOWPayments:
  - the payable amount is forced to the same numeric course price
  - example: `15.00` course -> `15.00 USDT`
- Direct BSC checkout for courses under `12.00`:
  - a tiny verification suffix is added
  - example: `1.00` course -> `1.002571 USDT`
  - this is intentional so the backend can safely distinguish simultaneous payments to the same wallet

Without the suffix, two users sending exactly `1.00 USDT` to the same shared address at the same time would be difficult to match safely on BSC.

## NOWPayments BSC Setup

The app creates hosted BSC-network payment requests through NOWPayments for courses priced at `12.00` and above. Do not place wallet private keys in this application.

Required variables:

```env
NOWPAYMENTS_API_KEY=your-nowpayments-api-key
NOWPAYMENTS_IPN_SECRET=your-nowpayments-ipn-secret
NOWPAYMENTS_BASE_URL=https://api.nowpayments.io
NOWPAYMENTS_IPN_URL=https://api.edutech.study/api/v1/payments/nowpayments/ipn
NOWPAYMENTS_PAY_CURRENCY=usdtbsc
NOWPAYMENTS_TIMEOUT_MS=30000
```

Behavior:

- the backend sends `price_amount` from the course price
- the backend also sends `pay_amount` so hosted checkout can show the same numeric `USDT` amount as the course price
- example:
  - course price: `12.00`
  - hosted crypto amount: `12.00 USDT`

## Direct BSC Setup

The app uses direct on-chain `USDT` reception on `BSC (BEP20)` for courses priced below `12.00`.

Required variables:

```env
BSC_RPC_URL=https://bsc-dataseed.binance.org
BSC_RECIPIENT_ADDRESS=0x057b1d7e10296d247d1b7c75eb4ae3aaf3daeea7
BSC_USDT_CONTRACT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
BSC_PAYMENT_EXPIRY_MINUTES=60
BSC_CONFIRMATIONS_REQUIRED=1
BSC_CHAIN_ID=56
BSC_EXPLORER_BASE_URL=https://bscscan.com
```

Before production:

1. Confirm the payout wallet/address configured in NOWPayments is a valid BSC-compatible receiving address.
2. Confirm `NOWPAYMENTS_PAY_CURRENCY` matches the asset you want customers to send on BSC.
3. Verify the public IPN URL is reachable and the IPN secret is set on both sides.
4. Confirm `BSC_RECIPIENT_ADDRESS` is the intended direct-wallet destination.
5. Confirm `BSC_USDT_CONTRACT_ADDRESS` is the official USDT contract on BSC before production rollout.

## Exchange Rate Setup

The backend fetches `AFN`, `IRR`, and `USDT` together from CurrencyAPI in one
daily request. CurrencyAPI's USD/IRR value tracks the market-style rate shown
by Google instead of the old official `42,000 IRR` value.

Supported configuration:

```env
EXCHANGE_RATE_PROVIDER=currencyfreaks
CURRENCYFREAKS_API_KEY=your-currencyfreaks-api-key
CURRENCYFREAKS_BASE_URL=https://api.currencyfreaks.com/v2.0
CURRENCYFREAKS_TIMEOUT_MS=10000
CURRENCYFREAKS_CACHE_TTL_MS=300000
IRAN_MARKET_RATE_PROVIDER=currencyapi
IRAN_MARKET_CACHE_TTL_MS=86400000
CURRENCYAPI_API_KEY=your-currencyapi-key
CURRENCYAPI_BASE_URL=https://api.currencyapi.com/v3
IRAN_MARKET_MIN_USD_TO_TOMAN_RATE=50000
CURRENCY_CONVERSION_DEBUG=false
HESABPAY_EXCHANGE_RATE_API_URL=https://open.er-api.com/v6/latest/USD
HESABPAY_EXCHANGE_RATE_TIMEOUT_MS=10000
HESABPAY_EXCHANGE_RATE_CACHE_TTL_MS=300000
HESABPAY_EXCHANGE_RATE_EMERGENCY_FALLBACK_RATE=70
HESABPAY_USD_TO_AFN_RATE=70
```

Behavior:

- uses one CurrencyAPI request for `data.AFN.value`, `data.IRR.value`, and
  `data.USDT.value`
- stores both the normalized toman value and its IRR equivalent
- force-refreshes all rates at 11:00 and 13:00 Kabul time and persists each
  snapshot, using about 60–62 scheduled requests per month
- validates the returned currency rate
- rejects Iran rates below the configured market sanity threshold, preventing
  the official 4,200-toman rate from entering pricing
- treats CurrencyAPI's IRR value as rials and divides it by 10 when storing
  the normalized toman rate
- caches the rate in memory and on disk only for the configured TTL; an old persisted rate is not treated as fresh until the next daily refresh
- falls back to the last known good rate when available
- keeps an emergency fallback rate for `AFN` so HesabPay can still function if the upstream API is temporarily unavailable
- logs when fallback behavior is used
- can temporarily log raw IRR, normalized toman, teacher toman, and final USD values with `CURRENCY_CONVERSION_DEBUG=true`

## API Routes

Primary payment routes:

- `GET /api/v1/exchange/quote?amount=100&to=AFN`
- `POST /api/v1/payments/checkout`
- `GET /api/v1/payments/:paymentAttemptId/status`
- `POST /api/v1/payments/:paymentAttemptId/verify-direct-crypto`
- `POST /api/v1/payments/hesabpay/webhook`
- `POST /api/v1/payments/nowpayments/ipn`

Student-compatible aliases remain available:

- `POST /api/v1/student/payments/create-session`
- `POST /api/v1/student/payments/checkout`
- `GET /api/v1/student/payments/:paymentAttemptId/status`
- `GET /api/v1/student/payments/history`

## Verification Flow

### HesabPay

1. Backend reads the course USD price.
2. Backend creates an AFN quote and stores it on the payment attempt.
3. Backend creates the HesabPay session.
4. Browser redirect is informational only.
5. Payment completes only after verified server-side webhook processing.
6. The webhook calls the shared `completePayment(...)` service.

### NOWPayments / BSC

1. Backend reads the course USD price.
2. For courses priced at `12.00` and above, backend creates a hosted NOWPayments checkout on the configured BSC asset.
3. Backend stores the quoted amount, network, provider payment ID, and destination address on the payment attempt.
4. Browser success is not trusted.
5. Payment completes only after a verified NOWPayments IPN is received server-side.
6. Verified NOWPayments payments call the shared `completePayment(...)` service.

### Direct USDT On BSC

1. Backend reads the course USD price.
2. For courses priced below `12.00`, backend creates a direct BSC payment attempt.
3. Backend generates a tiny unique suffix and stores:
   - base amount
   - unique suffix
   - final payable amount
4. Student sends the exact amount in `USDT` on `BSC (BEP20)`.
5. Student submits the transaction hash.
6. Backend verifies on-chain:
   - transaction exists
   - transaction succeeded
   - chain is BSC
   - token contract is the configured USDT contract
   - recipient matches the configured merchant wallet
   - amount matches exactly
   - tx hash has not been used
7. Only then does the shared `completePayment(...)` service activate the enrollment.

## Duplicate And Late Payments

- The first verified payment marks the order `PAID`
- Enrollment is created exactly once
- A later valid payment for the same order is marked `DUPLICATE_PAYMENT`
- Duplicate attempts preserve provider or blockchain audit data for refund review
- Amount mismatches or partial NOWPayments settlements move to `MANUAL_REVIEW`
- A direct BSC payment detected after expiry moves to `MANUAL_REVIEW`

## Development

Install dependencies and run the server:

```bash
npm install
npm run dev
```

Start in non-watch mode:

```bash
npm run start
```

Health endpoint:

```text
GET /api/v1/health
```

## Tests

Run backend tests:

```bash
npm test
```

Current automated coverage focuses on payment quoting, idempotency, and NOWPayments/HesabPay behavior with mocked provider responses. No real money is required for tests.

## Environment Variables

Keep the required NOWPayments, BSC, HesabPay, and Telegram values in `backend/.env.development` for local development.

### AI Chat

The student dashboard chatbot uses local `Ollama` models with no per-message API fee.

Add these values to `backend/.env.development`:

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_CHAT_MODEL=gemma3:4b
```

Current behavior:

- only logged-in students can use it
- the chatbot is available inside the student dashboard layout
- no separate database storage is required for the first version
- the frontend sends recent chat history with each request
- off-topic questions are refused so the assistant stays focused on EduTech platform tasks
- common platform questions can return instant fast-path answers before calling the model
- the Ollama request is tuned for faster platform-focused replies with smaller grounding context
- saved platform context is reused from in-memory cache and automatically refreshed when platform data changes
- public, student, teacher, and admin route/page knowledge is read from the current source files and refreshed automatically when those files change

For a free local setup with Ollama:

```bash
ollama serve
ollama pull gemma3:4b
```

### Telegram Announcement Bot

Add these Telegram values to `backend/.env.development`:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_PUBLIC_CHANNEL_ID=@EduTechStudy
TELEGRAM_SUPPORT_CHAT_ID=
FRONTEND_URL=https://edutech.study
```

Setup steps:

1. Create a bot with `@BotFather` and copy the bot token into `backend/.env.development`.
2. Create your public Telegram channel, for example `@EduTechStudy`.
3. Add the bot to the public channel as an admin.
4. Give the bot permission to post messages.
5. Open the admin panel Telegram settings page, save the public channel values, and send a test post.
6. Set `TELEGRAM_SUPPORT_CHAT_ID` to your personal chat, private group, or support channel if you want contact-form alerts separate from the public channel.

What is included:

- Automatic Telegram announcements for newly published courses
- Automatic Telegram announcements for newly approved teachers
- Event announcement service support and admin settings for future event integration
- Delivery log storage in MongoDB for posted and failed announcements

## Production Notes

- Do not deploy the checked-in `.env` file as-is. Rotate secrets and set production values on the server.
- Set `UPLOADS_DIR` to an absolute, persistent directory outside the Git checkout,
  such as `/var/lib/edutech/uploads`. This prevents `git reset --hard` from
  deleting course images and other user uploads.
- `JWT_SECRET` should be a long random value.
- `CLIENT_ORIGIN` should list only your real frontend origins in production.
- `COURSE_PUBLIC_ORIGIN` is required in production for public share links and web-push URLs.
- Public requests are limited per IP with `API_RATE_LIMIT_MAX` (default `300` per window).
- Requests with a valid login token are limited per account with
  `API_AUTH_RATE_LIMIT_MAX` (default `3000` per window), so student, teacher,
  admin, and support users behind one network do not block each other.
- Request body limits are configurable with:
  - `JSON_BODY_LIMIT`
  - `URL_ENCODED_LIMIT`
  - `URL_ENCODED_PARAMETER_LIMIT`
- Health check endpoint:
  - `GET /api/v1/health`

Recommended production rate-limit values:

```env
API_RATE_LIMIT_WINDOW_MS=900000
API_RATE_LIMIT_MAX=300
API_AUTH_RATE_LIMIT_MAX=3000
TRUST_PROXY=1
```

### Persistent uploads and safe deployments

Runtime uploads must live outside the repository. Before deploying this change
for the first time, copy the existing files **before** running `git reset
--hard`. Adjust `/var/www/edutech` if the checkout is elsewhere:

```bash
sudo install -d -o "$(id -un)" -g "$(id -gn)" /var/lib/edutech/uploads
sudo cp -a /var/www/edutech/backend/uploads/. /var/lib/edutech/uploads/
```

Then add this value to the backend's production environment file:

```env
UPLOADS_DIR=/var/lib/edutech/uploads
```

After confirming the copied files exist, normal code deployments can safely use
`git fetch origin main` and `git reset --hard origin/main`. Back up the persistent
uploads directory independently; Git no longer stores user uploads.

Run exactly one API process because the exchange-rate and course workers are
singleton schedulers:

```bash
cd /var/www/edutech
pm2 delete edutech-api
pm2 start ecosystem.config.cjs --only edutech-api
pm2 save
```
