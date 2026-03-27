const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: string;
}

export async function sendExpoPush(message: PushMessage): Promise<boolean> {
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        to: message.to,
        title: message.title,
        body: message.body,
        data: message.data ?? {},
        sound: message.sound ?? "default",
      }),
    });

    if (!response.ok) {
      console.error("Expo push failed:", await response.text());
      return false;
    }

    return true;
  } catch (err) {
    console.error("Error sending push:", err);
    return false;
  }
}
