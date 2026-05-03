/**
 * SMS Utility for Semaphore API
 */

export async function sendSMS(to: string, message: string) {
  // @ts-ignore
  const apiKey = import.meta.env.VITE_SEMAPHORE_API_KEY || 'YOUR_SEMAPHORE_API_KEY';
  
  if (apiKey === 'YOUR_SEMAPHORE_API_KEY') {
    console.log('SMS Simulation:', { to, message });
    return { success: true, simulated: true };
  }

  try {
    const response = await fetch('https://api.semaphore.co/api/v4/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        apikey: apiKey,
        number: to,
        message: message,
      }),
    });

    const data = await response.json();
    console.log('Semaphore API Response:', data);
    return { success: true, data };
  } catch (error) {
    console.error('SMS Send Failed:', error);
    return { success: false, error };
  }
}
