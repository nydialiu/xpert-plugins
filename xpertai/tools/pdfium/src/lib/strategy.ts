import { Injectable } from '@nestjs/common'
import { BuiltinToolset, IToolsetStrategy, ToolsetStrategy } from '@xpert-ai/plugin-sdk'
import { Pdfium, icon } from './types.js'
import { PdfiumToolset } from './toolset.js'
import { buildPdfToMarkdownTool } from './pdf2markdown.tool.js'

@Injectable()
@ToolsetStrategy(Pdfium)
export class PdfiumStrategy implements IToolsetStrategy<any> {

  meta = {
    author: 'Xpert AI',
    tags: ['pdf', 'markdown', 'convert', 'extract', 'images'],
    name: Pdfium,
    label: {
      en_US: 'PDF to Markdown',
      zh_Hans: 'PDF 转 Markdown'
    },
    description: {
      en_US: 'Convert PDF files to markdown with extracted text and rendered page images.',
      zh_Hans: '将 PDF 转换为 Markdown，包含提取的文本和页面图片。'
    },
    icon: {
      svg: icon,
      color: '#ff6600'
    },
    configSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }

  validateConfig(_config: any): Promise<void> {
    return Promise.resolve()
  }

  async create(config: any): Promise<BuiltinToolset> {
    return new PdfiumToolset(config)
  }

  createTools() {
    return [
      buildPdfToMarkdownTool()
    ]
  }
}
