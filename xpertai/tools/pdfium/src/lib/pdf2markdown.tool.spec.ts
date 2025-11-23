import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { getCurrentTaskInput } from '@langchain/langgraph'
import { PDFiumLibrary } from '@hyzyla/pdfium'
import { buildPdfToMarkdownTool } from './pdf2markdown.tool.js'
import { PNG } from 'pngjs'

jest.mock('@hyzyla/pdfium', () => ({
  PDFiumLibrary: {
    init: jest.fn()
  }
}))

jest.mock('@langchain/langgraph', () => ({
  getCurrentTaskInput: jest.fn()
}))

describe('buildPdfToMarkdownTool', () => {
  let workspacePath: string
  let pdfTool: ReturnType<typeof buildPdfToMarkdownTool>
  const mockedGetCurrentTaskInput = getCurrentTaskInput as jest.MockedFunction<typeof getCurrentTaskInput>
  const mockedPDFiumInit = PDFiumLibrary.init as jest.MockedFunction<typeof PDFiumLibrary.init>

  const createPdfiumMock = (pageTexts: string[]) => {
    const pages = pageTexts.map((text, index) => ({
      getText: jest.fn(() => text),
      render: jest.fn().mockResolvedValue({
        width: 1,
        height: 1,
        format: index === 0 ? 'BGRA' : 'RGBA',
        data: Uint8Array.from([
          // BGRA pixel that should become RGBA when written as PNG
          index === 0 ? 0 : 255, // B
          0,                     // G
          index === 0 ? 255 : 0, // R
          255                    // A
        ])
      })
    }))
    const pdf = {
      getPageCount: jest.fn(() => pages.length),
      getPage: jest.fn((idx: number) => pages[idx]),
      destroy: jest.fn()
    }
    const pdfium = {
      loadDocument: jest.fn().mockResolvedValue(pdf),
      destroy: jest.fn()
    }
    mockedPDFiumInit.mockResolvedValue(pdfium as any)
    return { pdfium, pdf, pages }
  }

  beforeEach(async () => {
    jest.resetAllMocks()
    workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfium-tool-'))
    mockedGetCurrentTaskInput.mockReturnValue({
      sys: {
        volume: workspacePath,
        workspace_url: 'http://localhost/workspace/'
      }
    })
    pdfTool = buildPdfToMarkdownTool()
  })

  afterEach(async () => {
    // await fs.rm(workspacePath, { recursive: true, force: true })
  })

  it('returns error when no input is provided', async () => {
    const result = await pdfTool.invoke({})

    expect(result).toContain('Error: No PDF file provided')
    expect(mockedPDFiumInit).not.toHaveBeenCalled()
  })

  it('converts a PDF from file path and writes markdown and images', async () => {
    const { pdfium, pdf } = createPdfiumMock([' First page text ', ''])
    const pdfPath = path.join(workspacePath, 'sample.pdf')
    await fs.writeFile(pdfPath, Buffer.from('dummy-pdf'))

    const result = await pdfTool.invoke({
      filePath: pdfPath,
      fileName: 'sample.pdf',
      scale: 1.5
    })

    const parsed = JSON.parse(result as string)
    expect(parsed.pages).toBe(2)
    expect(parsed.group).toBe('sample')
    expect(parsed.markdown.filePath).toBe(path.join(workspacePath, 'sample', 'result.md'))
    expect(parsed.images).toHaveLength(2)

    const mdContent = await fs.readFile(parsed.markdown.filePath, 'utf8')
    expect(mdContent).toContain('PDF Converted to Markdown')
    expect(mdContent).toContain('First page text')
    expect(mdContent).toContain('No extractable text')

    const firstImage = parsed.images[0]
    const firstPng = PNG.sync.read(await fs.readFile(firstImage.filePath))
    expect(firstPng.width).toBe(1)
    expect(firstPng.height).toBe(1)
    expect(Array.from(firstPng.data.slice(0, 4))).toEqual([255, 0, 0, 255])

    expect(pdfium.loadDocument).toHaveBeenCalled()
    expect(pdf.destroy).toHaveBeenCalled()
    expect(pdfium.destroy).toHaveBeenCalled()
  })

  it('appends pdf extension when missing and builds file urls', async () => {
    createPdfiumMock(['Hello'])
    const inputDir = path.join(workspacePath, 'input')
    await fs.mkdir(inputDir, { recursive: true })
    const pdfPath = path.join(inputDir, 'document')
    await fs.writeFile(pdfPath, Buffer.from('content'))

    const result = await pdfTool.invoke({
      filePath: pdfPath,
      fileName: 'document'
    })

    const parsed = JSON.parse(result as string)
    expect(parsed.group).toBe('document')
    expect(parsed.markdown.fileName).toBe(path.join('document', 'result.md'))
    expect(parsed.markdown.fileUrl).toBe('http://localhost/workspace/document/result.md')
    expect(parsed.images[0].fileName).toBe(path.join('document', 'page-1.png'))
    expect(parsed.images[0].fileUrl).toBe('http://localhost/workspace/document/page-1.png')
  })

  it('processes the real fixture PDF and groups outputs by file name', async () => {
    createPdfiumMock(['指南第一页', '指南第二页'])
    const fixturePath = path.join(process.cwd(), '__fixtures__', '一加 Ace 5 Pro_入门指南_CN.pdf')
    await fs.access(fixturePath)

    const result = await pdfTool.invoke({
      filePath: fixturePath
    })

    const parsed = JSON.parse(result as string)
    console.log(parsed)
    expect(parsed.pages).toBe(2)
    expect(parsed.group).toBe('一加 Ace 5 Pro_入门指南_CN')
    expect(parsed.markdown.filePath).toBe(path.join(workspacePath, '一加 Ace 5 Pro_入门指南_CN', 'result.md'))
    expect(parsed.images).toHaveLength(2)
    parsed.images.forEach((img: any, idx: number) => {
      expect(img.page).toBe(idx + 1)
      expect(img.filePath).toBe(path.join(workspacePath, '一加 Ace 5 Pro_入门指南_CN', `page-${idx + 1}.png`))
    })
  })
})
