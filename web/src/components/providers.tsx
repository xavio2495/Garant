"use client";

import { createContext, useContext, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { WagmiProvider as PlainWagmiProvider, createConfig as createPlainConfig, http, useAccount } from "wagmi";
import { chain } from "@/lib/chain";

const queryClient = new QueryClient();
const transports = { [chain.id]: http() } as const;
const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

type Auth = {
  enabled: boolean;
  ready: boolean;
  signedIn: boolean;
  address?: `0x${string}`;
  signIn: () => void;
  signOut: () => void;
};

const AuthContext = createContext<Auth>({
  enabled: false,
  ready: true,
  signedIn: false,
  signIn: () => {},
  signOut: () => {},
});

export const useAuth = () => useContext(AuthContext);

function PrivyAuth({ children }: { children: ReactNode }) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { address } = useAccount();
  return (
    <AuthContext.Provider
      value={{ enabled: true, ready, signedIn: authenticated, address, signIn: login, signOut: logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  if (!privyAppId) {
    return (
      <QueryClientProvider client={queryClient}>
        <PlainWagmiProvider config={createPlainConfig({ chains: [chain], transports })}>{children}</PlainWagmiProvider>
      </QueryClientProvider>
    );
  }
  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        defaultChain: chain,
        supportedChains: [chain],
        loginMethods: ["email", "google"],
        appearance: { theme: "light", accentColor: "#1E6B58" },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={createConfig({ chains: [chain], transports })}>
          <PrivyAuth>{children}</PrivyAuth>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
