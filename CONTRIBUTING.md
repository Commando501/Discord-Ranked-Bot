# Contributing to MatchMaker

Thank you for considering contributing to MatchMaker! This document outlines the process for contributing to the project and guidelines to follow.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful, inclusive, and considerate in all interactions with the community.

## Getting Started

### Prerequisites

- Node.js 16.x or later
- PostgreSQL database
- Discord Bot Token (for testing)

### Development Environment Setup

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/matchmaker.git
   cd matchmaker
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Set up your local environment:
   ```bash
   # Create a .env file with your development credentials
   cp .env.example .env
   # Edit the .env file with your credentials
   ```

5. Initialize the database:
   ```bash
   npm run db:push
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

## Development Workflow

### Branching Strategy

We use a simplified Git workflow:

- `main` branch is the stable release branch
- Feature/bugfix branches should be created from `main`
- Use descriptive branch names, e.g., `feature/add-team-balancing` or `fix/queue-display-bug`

### Making Changes

1. Create a new branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes, adhering to the [Coding Standards](#coding-standards)

3. Test your changes thoroughly

4. Commit your changes with clear, descriptive messages:
   ```bash
   git commit -m "Add feature: detailed description of your change"
   ```

5. Push your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

6. Create a Pull Request from your branch to the main repository

### Pull Requests

When submitting a Pull Request, please:

1. Provide a clear, descriptive title
2. Include a detailed description of the changes
3. Reference any related issues using GitHub keywords (e.g., "Fixes #123")
4. Ensure all checks pass (linting, tests, etc.)
5. Request a review from a maintainer

## Coding Standards

### TypeScript Guidelines

- Use TypeScript's static typing features effectively
- Define interfaces for data structures
- Avoid using `any` type when possible
- Use async/await for asynchronous operations

### Code Style

- The project uses ESLint and Prettier for code formatting
- Run linting before submitting your PR:
  ```bash
  npm run lint
  ```

- Common style guidelines:
  - Use camelCase for variables and functions
  - Use PascalCase for classes and interfaces
  - Use meaningful variable and function names
  - Keep functions small and focused on a single responsibility
  - Add comments for complex logic

### Architecture Guidelines

- Follow the established architectural patterns in the codebase
- Place new files in the appropriate directories according to their function
- Maintain separation of concerns between layers:
  - Interface Layer (Discord commands/interactions)
  - Service Layer (Business logic)
  - Data Access Layer (Database operations)

### Error Handling

- Use try/catch blocks for error handling
- Log errors with appropriate context
- Return meaningful error messages to users

## Testing

We value tests to ensure code quality and prevent regressions.

- Write unit tests for new functionality
- Ensure existing tests pass before submitting a PR
- Run tests with:
  ```bash
  npm test
  ```

## Documentation

Please update documentation when adding or changing features:

- Update README.md if necessary
- Add or update documentation in the `docs` directory
- Include JSDoc comments for functions and classes

## Feature Requests and Bug Reports

- Use GitHub Issues to submit feature requests and bug reports
- Provide detailed descriptions and, if possible, steps to reproduce bugs
- Label issues appropriately ("bug", "enhancement", "documentation", etc.)

## Review Process

All submissions require review before merging:

1. Automated checks must pass (linting, tests)
2. At least one maintainer must approve the changes
3. Feedback may require changes to your submission

## Deployment

Only project maintainers handle deployments to production environments.

## Questions and Discussion

If you have questions or want to discuss ideas:

- Open a Discussion on GitHub for broad topics
- Join our Discord server for real-time chat
- Contact maintainers directly for sensitive matters

## License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project (MIT License).

Thank you for your contributions!