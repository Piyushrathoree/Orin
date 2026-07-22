'use client';

import { Button } from '@/components/ui/button';

export default function Demo() {
    const handleBlocking = async () => {
        await fetch('/api/demo/blocking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'user',
                        content: 'Hello, how are you?',
                    },
                ],
            }),
        }
        );
    };
    return (
        <div className="flex flex-col gap-4"> 
            <Button onClick={handleBlocking}>Blocking</Button>
        </div>
    );
}


