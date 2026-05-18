'use client';

import { Authenticated, AuthLoading, ConvexReactClient, Unauthenticated } from 'convex/react';
import { ClerkProvider, SignInButton, SignUpButton, useAuth } from '@clerk/nextjs';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ThemeProvider } from './theme-provider';

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const Providers = ({ children }: { children: React.ReactNode }) => {
    return (
        <ClerkProvider>
            <ConvexProviderWithClerk useAuth={useAuth} client={convex}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="dark"
                    enableSystem
                    disableTransitionOnChange
                >
                    <Authenticated>{children}</Authenticated>
                    <Unauthenticated>
                        <SignInButton />
                        <SignUpButton />
                    </Unauthenticated>
                    <AuthLoading>Loading...</AuthLoading>
                </ThemeProvider>
            </ConvexProviderWithClerk>
        </ClerkProvider>
    );
};
