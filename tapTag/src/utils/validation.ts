// Validation is intentionally minimal because this is a thin auth layer, not a
// full onboarding system.
export const validateEmail = (email: string): boolean => {
  // Lightweight format check, enough for fast front-end feedback in demo mode.
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim());
};

export const validatePassword = (password: string): boolean => {
  // Keeps the threshold simple for this beta slice.
  return password.length >= 6;
};
