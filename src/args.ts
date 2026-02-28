import path from "node:path";
import { CliArgs } from "./types";

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    command: "run",
    repoPath: "",
    force: false,
    noPrompt: false,
    verbose: false,
  };

  const positionals: string[] = [];
  let startIndex = 0;

  if (argv[0] === "init") {
    args.command = "init";
    startIndex = 1;
  }

  for (let i = startIndex; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case "--config":
        args.configPath = next;
        i += 1;
        break;
      case "--output":
        args.output = next;
        i += 1;
        break;
      case "--json":
        args.jsonPath = next;
        i += 1;
        break;
      case "--html":
        args.htmlDir = next;
        i += 1;
        break;
      case "--max-graph-nodes":
        args.maxGraphNodes = Number.parseInt(next, 10);
        i += 1;
        break;
      case "--base-url":
        args.baseUrl = next;
        i += 1;
        break;
      case "--model":
        args.model = next;
        i += 1;
        break;
      case "--api-key":
        args.apiKey = next;
        i += 1;
        break;
      case "--no-prompt":
        args.noPrompt = true;
        break;
      case "--force":
        args.force = true;
        break;
      case "--verbose":
        args.verbose = true;
        break;
      case "-h":
      case "--help":
        printHelpAndExit(0);
        break;
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown flag: ${arg}`);
        }
        positionals.push(arg);
        break;
    }
  }

  if (positionals.length < 1) {
    printHelpAndExit(1);
  }

  args.repoPath = path.resolve(positionals[0]);
  return args;
}

function printHelpAndExit(code: number): never {
  // eslint-disable-next-line no-console
  console.log(`Usage:
  explain <repoPath> [options]
  explain init <repoPath> [options]

Options:
  --config <path>            Path to .explainrc.json
  --output <path>            Output root path
  --json <path>              JSON output path
  --html <dir>               HTML output directory
  --max-graph-nodes <n>      Dependency graph node cap (default 50)
  --base-url <url>           LLM base URL override
  --model <model>            LLM model override
  --api-key <key>            LLM API key override
  --no-prompt                Disable interactive prompts
  --force                    Re-run explanations for all entities
  --verbose                  Verbose logs
  -h, --help                 Show this help
`);
  process.exit(code);
}
