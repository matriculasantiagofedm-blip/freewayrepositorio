

export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  requestResourceData?: any;
};

/**
 * A custom error class for Firestore permission errors that includes
 * rich contextual information about the failed request.
 */
export class FirestorePermissionError extends Error {
  public readonly context: SecurityRuleContext;
  public readonly name = 'FirestorePermissionError';
  
  constructor(context: SecurityRule_Context) {
    const message = `
FirestoreError: Missing or insufficient permissions. The following request was denied by Firestore Security Rules:
${JSON.stringify({
  // We mimic the structure of a real Firestore security rule debug error.
  rules: {
    // The request context provided by the developer.
    request: {
      auth: {
        uid: "/* GUEST (review your rules and make sure the user is signed in) */",
        token: {
          "/* This is a mock token. See the actual user's token below. */": "/* The user's auth token is not available in the client-side error. */"
        }
      },
      method: context.operation.toUpperCase(),
      path: `/databases/(default)/documents/${context.path}`,
      // Add a note about the resource data.
      ...(context.requestResourceData && { resource: { data: context.requestResourceData } }),
    },
    // Add a helper message for debugging.
    debug: {
      message: "To fix this, update your firestore.rules file to allow this operation. You may need to inspect the request object and the user's custom claims to write the correct rule.",
    }
  }
}, null, 2)}
`;
    super(message);
    this.context = context;
    // This is to ensure that the error is properly recognized as an instance of FirestorePermissionError
    Object.setPrototypeOf(this, FirestorePermissionError.prototype);
  }
}

// Renamed to avoid conflict with global type
export type SecurityRule_Context = SecurityRuleContext;
