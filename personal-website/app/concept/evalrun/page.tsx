import type { Metadata } from 'next';
import { EvalRun } from '@/components/concept/evalrun/EvalRun';

export const metadata: Metadata = {
  title: 'Concept E · Eval Run - Tyler Xiao',
};

export default function EvalRunPage() {
  return <EvalRun />;
}
