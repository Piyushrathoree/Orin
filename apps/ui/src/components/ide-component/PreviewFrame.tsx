'use client';

import React, { useEffect, useState } from 'react';

interface PreviewFrameProps {
    url: string;
    device: 'desktop' | 'tablet' | 'mobile';
    refreshKey: number;
}

const deviceConfigs = {
    desktop: {
        width: '100%',
        height: '100%',
        borderRadius: 0,
    },
    tablet: {
        width: 768,
        height: 1024,
        borderRadius: 8,
    },
    mobile: {
        width: 375,
        height: 812,
        borderRadius: 8,
    },
} as const;

const PreviewFrame: React.FC<PreviewFrameProps> = ({ url, device, refreshKey }) => {
    const config = deviceConfigs[device];
    const isDesktop = device === 'desktop';
    const frameKey = `${url}-${refreshKey}`;
    const [loadedFrame, setLoadedFrame] = useState<string | null>(null);
    const [slowFrame, setSlowFrame] = useState<string | null>(null);
    const isLoaded = loadedFrame === frameKey;
    const isSlow = slowFrame === frameKey;

    useEffect(() => {
        const timer = window.setTimeout(() => setSlowFrame(frameKey), 8_000);
        return () => window.clearTimeout(timer);
    }, [frameKey]);

    return (
        <div className="relative flex h-full w-full items-center justify-center overflow-auto bg-background">
            <div
                className="relative overflow-hidden bg-white"
                style={
                    isDesktop
                        ? { width: '100%', height: '100%' }
                        : {
                              width: config.width,
                              height: config.height,
                              borderRadius: config.borderRadius,
                              flexShrink: 0,
                          }
                }
            >
                {!isLoaded && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background px-6 text-center text-sm text-muted-foreground">
                        {isSlow
                            ? 'Preview is taking longer than expected. Check the terminal for errors.'
                            : 'Loading preview...'}
                    </div>
                )}
                <iframe
                    key={frameKey}
                    src={url}
                    className="h-full w-full border-0 bg-white"
                    title="Preview"
                    allow="fullscreen; clipboard-read; clipboard-write"
                    onLoad={() => setLoadedFrame(frameKey)}
                />
            </div>
        </div>
    );
};

export default PreviewFrame;
