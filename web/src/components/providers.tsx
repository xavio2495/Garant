"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import {
  WagmiProvider as PlainWagmiProvider,
  createConfig as createPlainConfig,
  http,
  useAccount,
  useConnect,
  useDisconnect,
} from "wagmi";
import { injected } from "wagmi/connectors";
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

// Without Privy, people sign in with a browser wallet
function InjectedAuth({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const available = useSyncExternalStore(
    () => () => {},
    () => "ethereum" in window,
    () => false,
  );
  return (
    <AuthContext.Provider
      value={{
        enabled: available,
        ready: !isPending,
        signedIn: isConnected,
        address,
        signIn: () => connect({ connector: injected(), chainId: chain.id }),
        signOut: () => disconnect(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

const injectedConfig = createPlainConfig({ chains: [chain], connectors: [injected()], transports });

export function Providers({ children }: { children: ReactNode }) {
  if (!privyAppId) {
    return (
      <QueryClientProvider client={queryClient}>
        <PlainWagmiProvider config={injectedConfig}>
          <InjectedAuth>{children}</InjectedAuth>
        </PlainWagmiProvider>
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
        appearance: { theme: "dark", accentColor: "#ffffff" },
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
