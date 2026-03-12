// Lovable integration stub - OAuth removed (Express backend handles auth)

export const lovable = {
  auth: {
    signInWithOAuth: async (_provider: "google" | "apple", _opts?: any) => {
      return { error: new Error("OAuth não disponível. Use login por email/senha.") };
    },
  },
};
