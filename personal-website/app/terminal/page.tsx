import { Terminal } from "../../components/Terminal/Terminal";

export const metadata = {
  title: "Terminal | Tyler Xiao",
  description: "Interactive terminal",
};

export default function TerminalPage() {
  return <Terminal isFullScreen={true} />;
}
