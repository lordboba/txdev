import type { Metadata } from 'next';
import { Journey } from '@/components/journey/Journey';

export const metadata: Metadata = {
  title: 'Journey - Tyler Xiao',
  description:
    'A short, no-fail autobiographical game: move through places, memories, and artifacts from San Diego to the horizon instead of clicking through a resume.',
};

export default function JourneyPage() {
  return <Journey standalone />;
}
