// Validation is intentionally minimal because this is a thin auth layer, not a
// full onboarding system.
export const validateEmail = (email: string): boolean => {
  // Lightweight format check, enough for front-end feedback before Firebase runs
  // its own server-side validation.
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim());
};

export const validatePassword = (password: string): boolean => {
  // Mirrors Firebase's minimum useful threshold for this beta slice.
  return password.length >= 6;
};
