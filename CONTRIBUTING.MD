# Contributing to LogicDrawer

First and foremost, thank you for considering contributing to LogicDrawer! We appreciate you taking the time to help us improve the project.

The following sections provide guidelines for contributing. These are primarily suggestions, not strict rules. We encourage you to use your best judgment and feel free to propose changes to this document in a pull request.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report any unacceptable behavior.

## How Can I Contribute?

### Reporting Bugs

If you encounter a bug, please open an issue on our GitHub repository. When you report a bug, please include the following details:

-   **A clear and descriptive title** for the issue.
-   **Steps to reproduce the bug** in as much detail as possible.
-   **What you expected to happen** versus what actually happened.
-   **Screenshots, GIFs, or logs** if they help illustrate the problem.
-   **Your environment details**, such as operating system, browser, and version.

### Suggesting Enhancements

If you have an idea for a new feature or an improvement to an existing one, please open an issue to discuss it. This allows us to coordinate our efforts and ensure that your suggestion aligns with the project's goals.

When suggesting an enhancement, please provide:

-   **A clear and descriptive title.**
-   **A detailed description** of the proposed enhancement and why it would be beneficial.
-   **Any mockups or examples** that might help illustrate your idea.

### Pull Requests

We welcome pull requests! If you're ready to contribute code, please follow the steps below.

## Getting Started

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** to your local machine:
    ```bash
    git clone https://github.com/your-username/LogicDrawer.git
    ```
3.  **Navigate to the project directory** and install the dependencies for both the client and the server:
    ```bash
    cd LogicDrawer
    npm install
    cd server
    npm install
    cd ..
    ```
4.  **Create a new branch** for your feature or bugfix:
    ```bash
    git checkout -b feature/your-awesome-feature
    ```

## Pull Request Process

1.  **Commit your changes** with a clear and descriptive commit message (see our [Style Guides](#style-guides)).
2.  **Push your branch** to your fork on GitHub:
    ```bash
    git push origin feature/your-awesome-feature
    ```
3.  **Open a pull request** to the `main` branch of the original repository.
4.  **Provide a clear description** of the changes you've made and reference any related issues.
5.  **Ensure all tests pass** before submitting your pull request.

## Style Guides

### Code Style

-   Follow the existing code style.
-   Use TypeScript and adhere to the configurations in `tsconfig.json` and `eslint.config.js`.
-   Write comments in English.

### Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification. Please format your commit messages as follows:

-   `feat`: A new feature.
-   `fix`: A bug fix.
-   `docs`: Documentation only changes.
-   `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc).
-   `refactor`: A code change that neither fixes a bug nor adds a feature.
-   `test`: Adding missing tests or correcting existing tests.
-   `chore`: Changes to the build process or auxiliary tools and libraries.

**Example:**
```
feat: Add support for multiplexer components
```

Thank you for your contribution!