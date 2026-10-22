export class AuthInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthInputError";
  }
}

export class AuthRequiredError extends Error {
  constructor() {
    super("Sign in to continue.");
    this.name = "AuthRequiredError";
  }
}

export class AuthConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConflictError";
  }
}
