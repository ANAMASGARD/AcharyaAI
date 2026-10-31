export type SuggestedChatPrompt = Readonly<{
  id: string;
  label: string;
  message: string;
}>;

export const SUGGESTED_CHAT_PROMPTS: SuggestedChatPrompt[] = [
  {
    id: "fractions-class-5",
    label: "Fractions · Class 5",
    message:
      "Help me teach fractions to Class 5 with hands-on activities for a 40-minute period.",
  },
  {
    id: "photosynthesis-science",
    label: "Photosynthesis · Science",
    message:
      "Create a 40-minute Science lesson on photosynthesis with a simple demo I can do in class.",
  },
  {
    id: "spoken-english-hindi",
    label: "अंग्रेज़ी · Class 8",
    message:
      "Class 8 ke liye spoken English practice activities batao — simple aur engaging, 30 minute ke liye.",
  },
];
