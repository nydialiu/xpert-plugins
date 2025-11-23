# Xpert Plugin: PDFium

`@xpert-ai/plugin-pdfium` converts PDF files into markdown with extracted text and rendered page images so agents can read or quote document content inside workflows.

## Installation

```bash
pnpm add @xpert-ai/plugin-pdfium
# or
npm install @xpert-ai/plugin-pdfium
```

> **Note**: This plugin lists `@xpert-ai/plugin-sdk`, `@nestjs/common@^11`, `@langchain/core@0.3.72`, `chalk@4.1.2`, and `zod@3.25.67` as peer dependencies. Make sure they are available in the host project before enabling the plugin.

## Quick Start

1. **Register the Plugin**  
   Enable it in your plugin list (environment variable or configuration):

   ```sh .env
   PLUGINS=@xpert-ai/plugin-pdfium
   ```

   The plugin bootstraps the `PdfiumModule` NestJS module and registers the toolset strategy.

2. **Provision Toolsets for Agents**  
   - Xpert Console: add a Built-in Toolset and choose `PDF to Markdown`.  
   - API: request toolset `pdfium`.  
   No credentials or secrets are required.

## PDFium Toolset

| Field        | Value                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------- |
| Name         | `pdfium`                                                                                       |
| Display Name | PDF to Markdown / PDF 转 Markdown                                                              |
| Category     | `tools`                                                                                        |
| Description  | Convert PDF files to markdown with extracted text and page images.                             |
| Config       | None required.                                                                                |

The toolset uses `@hyzyla/pdfium` to parse and render PDFs. Outputs include markdown plus per-page PNGs stored under the workspace volume so downstream tools can reuse them.

## Tools

| Tool              | Purpose                                                                                   | Input Highlights                                                                                                                                                                                                                                                                              | Output |
| ----------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `pdf_to_markdown` | Convert a PDF to markdown and render each page as PNG.                                    | - `fileUrl` **or** `filePath` **or** `content` (base64, Buffer, or `Uint8Array`) provides the PDF.<br>- `fileName` optional; inferred from `fileUrl`/`filePath` or defaults to `document.pdf` (auto-appends `.pdf` if missing).<br>- `scale` optional render scale (default `2.0`). | JSON string containing `pages`, `group`, `markdown` `{fileName,filePath,fileUrl?,mimeType}`, and `images[]` `{fileName,filePath,fileUrl?,mimeType,page}`. |

### Example Payload

```json
{
  "tool": "pdf_to_markdown",
  "input": {
    "filePath": "/tmp/invoice.pdf",
    "scale": 1.5
  }
}
```

The tool writes outputs under the workspace volume (derived from `sys.volume` in task input). When `sys.workspace_url` is available it also returns downloadable `fileUrl` values. Results are returned as JSON text; agents typically call `JSON.parse(result)` to consume the file metadata.

### Error Handling & Behavior

- Missing PDF inputs return a friendly error string (`"Error: No PDF file provided"`).
- If the file name lacks `.pdf`, the tool appends the extension for grouping outputs.
- Page text extraction may be empty for scanned pages; images are always rendered.
- Any thrown errors are returned as strings prefixed with `Error converting PDF: ...`.

## Permissions & Security

- **Network**: Only used when `fileUrl` is provided (HTTP fetch). Otherwise all work is local.
- **Filesystem**: Writes markdown and PNGs to the workspace directory; ensure the agent has write access there.
- **Logging**: Lifecycle logs are lightweight (`register`, `onStart`, `onStop`).

## Development & Testing

```bash
npm install
npx nx build @xpert-ai/plugin-pdfium
npx nx test @xpert-ai/plugin-pdfium
```

The Jest spec `src/lib/pdf2markdown.tool.spec.ts` covers tool behavior, including file output paths and URL generation.

## License

This project follows the [AGPL-3.0 License](../../../LICENSE) located at the repository root.
