# Contributing to GelombangMaya Community Edition

Welcome to GelombangMaya Community Edition (CE).

---

## Code of Conduct
* Treat fellow contributors and security researchers with mutual respect.
* Focus on constructive code reviews, reproducible testing, and clean commits.
* Keep offensive tools and detection heuristics ethical and responsible.

---

## Development Workflow

1. **Fork & Clone**:
   ```bash
   git clone https://github.com/elektrika-cloud/gelombangmaya-community.git
   cd gelombangmaya-community
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env to set your local MySQL/MariaDB connection
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

5. **Run Validation & Tests**:
   Before submitting your Pull Request, ensure all tests and lint checks pass cleanly:
   ```bash
   npm run check   # TypeScript compilation check
   npm run lint    # ESLint verification
   npm run test    # Vitest unit test suite
   npm run build   # Production bundle verification
   ```

---

## Adding New Detection Rules
If you are contributing new threat detection heuristics:
1. Ensure the rule follows the `GM-XXXX` naming convention.
2. Add comprehensive unit test cases in `api/detection.test.ts` with realistic attack log payloads.
3. Test against false positives on regular production system logs.

---

## Licensing Agreement & Contributor License Agreement (CLA)

By submitting a Pull Request, issue, or contributing code, documentation, or rules to this repository, you agree to the following terms:

1. **License Grant:** You agree that your contributions will be licensed to users under the terms of the **PolyForm Noncommercial License 1.0.0**.
2. **Copyright Assignment & Relicensing Rights:** You hereby grant **Elektrika Cloud** and the maintainers a perpetual, worldwide, non-exclusive, royalty-free, irrevocable, sublicensable license to use, reproduce, modify, display, sublicense, distribute, and relicense your contributions (in original or modified form) under any license terms, including commercial, dual-licensing, and proprietary enterprise licenses.
3. **Original Work Certification:** You certify that the contributions represent your original creation, and that you possess the necessary legal authority to grant the aforementioned rights without violating any third-party intellectual property or employment agreements.

