
export const getDisplayName = (fullName: string | undefined | null): string => {
  if (!fullName) return '';
  
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    // Single word name like "Taylor"
    return parts[0];
  }

  const first = parts[0];
  const last = parts[parts.length - 1];
  const lastInitial = last.charAt(0).toUpperCase();

  return `${first} ${lastInitial}`;
};
