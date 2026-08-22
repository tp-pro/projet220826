export type ContactActionState = {
  error: string | null;
  success: boolean;
};

export const initialContactActionState: ContactActionState = { error: null, success: false };
