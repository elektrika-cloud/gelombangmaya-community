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

## Licensing Agreement
By contributing to this repository, you agree that your contributions will be licensed under the PolyForm Noncommercial License 1.0.0.
