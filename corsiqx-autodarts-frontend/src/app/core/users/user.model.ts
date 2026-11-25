/** A user as exposed by the user list. Email and password hash never leave the API. */
export interface UserSummary {
  id: string;
  name: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
}

export type CreateUserField = keyof CreateUserPayload;

/** Failure of a create request, mapped so the form can show it next to the right field. */
export interface CreateUserError {
  field: CreateUserField | null;
  message: string;
}
