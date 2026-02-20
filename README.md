# Mini App: Certificates (RWA)

Issue and view **on-chain certificate NFTs** as Real World Assets (RWA). Example use case: universities issue diplomas to graduating students based on a certificate template and student data (name, class, grades).

## Features

- **Create templates** – Issuers define certificate types (e.g. "University Diploma 2025").
- **Issue certificates** – Mint certificate NFTs to a recipient with student name, class, and grades.
- **Claim certificates** – Recipients claim issued certificates so they appear in "My certificates".
- **View my certificates** – List and view all claimed certificates.

## Project structure

```
mini-app-certificates/
├── move/
│   ├── sources/
│   │   └── certificates.move   # Move contract (templates + certificates)
│   └── Move.toml
├── src/
│   └── app/
│       ├── page.tsx
│       ├── layout.tsx
│       └── globals.css
├── constants.ts                 # CERTIFICATES_MODULE_ADDRESS
├── package.json
└── README.md
```

## Getting started

1. **Install dependencies**

   ```bash
   cd mini-app-certificates
   npm install
   ```

2. **Deploy the Move contract**

   Deploy the `move/` package with your Move tooling (e.g. Movement CLI). Set the deployed module address in `constants.ts`:

   ```ts
   export const CERTIFICATES_MODULE_ADDRESS = "0x..."; // your deployed address
   ```

   Or use `NEXT_PUBLIC_CERTIFICATES_MODULE_ADDRESS` in `.env.local`.

3. **Run the app**

   ```bash
   npm run dev
   ```

4. **Test in Movement Everything**

   Open the app inside the Movement wallet (Developer Mode → Mini App Testing → your URL).

## Contract overview

- **`create_template(name, description)`** – Create a certificate template (issuer).
- **`issue_certificate(template_index, recipient, student_name, class_name, grades)`** – Issue a certificate to a recipient (issuer).
- **`claim_certificate(issuer, cert_index)`** – Recipient claims an issued certificate so it shows under "My certificates".

View functions: `is_issuer`, `get_template_count`, `get_template`, `get_certificate_count`, `get_certificate`, `get_recipient_cert_count`, `get_recipient_cert_ref`.

## Flow

1. **Issuer** creates one or more templates (e.g. "BS Computer Science 2025").
2. **Issuer** issues certificates by filling recipient address, student name, class, grades and selecting a template.
3. **Recipient** claims the certificate using the issuer address and certificate index (shared by the issuer).
4. **Recipient** sees all claimed certificates under "My certificates".
