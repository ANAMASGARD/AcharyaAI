import { images } from '@/constants/images';

type MascotImage = (typeof images)[keyof typeof images];

export type OnboardingSlide = {
  id: string;
  mascot: MascotImage;
  mascotLabel: string;
  titleLine1: string;
  titleLine2: string;
  description: string;
};

export const onboardingSlides: readonly OnboardingSlide[] = [
  {
    id: 'welcome',
    mascot: images.mascotWelcome,
    mascotLabel: 'Acharya mascot welcoming teachers',
    titleLine1: 'Namaste,',
    titleLine2: 'Teacher!',
    description:
      'Your AI teaching assistant built for real classrooms and busy school days.',
  },
  {
    id: 'record',
    mascot: images.mascotLogo,
    mascotLabel: 'Acharya mascot holding a book',
    titleLine1: 'Record',
    titleLine2: 'Your Class',
    description:
      'Start in seconds. Capture long sessions reliably while you focus on teaching.',
  },
  {
    id: 'insights',
    mascot: images.mascotPencil,
    mascotLabel: 'Acharya mascot with pencil',
    titleLine1: 'Grow Every',
    titleLine2: 'Lesson',
    description:
      'Get transcripts, teaching reports, and actionable feedback after every class.',
  },
] as const;
