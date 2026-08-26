import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import * as ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { BulkProductRowDto } from './dto/bulk-product-row.dto';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const CSV_MIMES = new Set(['text/csv', 'application/csv', 'text/plain']);

@Injectable()
export class ProductImportParser {
  async parse(file: Express.Multer.File): Promise<BulkProductRowDto[]> {
    const extension = file.originalname.toLowerCase().split('.').pop();
    const workbook = new ExcelJS.Workbook();
    if (extension === 'xlsx' && file.mimetype === XLSX_MIME) {
      const bytes = file.buffer.buffer.slice(
        file.buffer.byteOffset,
        file.buffer.byteOffset + file.buffer.byteLength,
      ) as ArrayBuffer;
      await workbook.xlsx.load(bytes);
    }
    else if (extension === 'csv' && CSV_MIMES.has(file.mimetype))
      await workbook.csv.read(Readable.from(file.buffer));
    else throw new BadRequestException('Only .xlsx and .csv files are supported');

    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) throw new BadRequestException('The file has no product rows');
    if (sheet.rowCount - 1 > 1000) throw new BadRequestException('A file cannot exceed 1000 product rows');

    const headers = this.readHeaders(sheet.getRow(1));
    const required = ['name', 'price', 'costPrice', 'quantityAtHand'] as const;
    const missing = required.filter((header) => !headers.has(header));
    if (missing.length) throw new BadRequestException(`Missing required columns: ${missing.join(', ')}`);

    const products: BulkProductRowDto[] = [];
    const rowErrors: string[] = [];
    for (let number = 2; number <= sheet.rowCount; number += 1) {
      const row = sheet.getRow(number);
      if (!row.hasValues) continue;
      const value = (name: keyof BulkProductRowDto) => row.getCell(headers.get(name)!).text.trim();
      const product = plainToInstance(BulkProductRowDto, {
        name: value('name'), price: value('price'), costPrice: value('costPrice'),
        quantityAtHand: value('quantityAtHand') ? Number(value('quantityAtHand')) : Number.NaN,
        ...(headers.has('category') && value('category') ? { category: value('category') } : {}),
        ...(headers.has('minMarginPct') && value('minMarginPct') ? { minMarginPct: Number(value('minMarginPct')) } : {}),
        ...(headers.has('minPrice') && value('minPrice') ? { minPrice: value('minPrice') } : {}),
        ...(headers.has('lowStockThreshold') && value('lowStockThreshold') ? { lowStockThreshold: Number(value('lowStockThreshold')) } : {}),
      });
      const messages = validateSync(product).flatMap((error) => Object.values(error.constraints ?? {}));
      if (messages.length) rowErrors.push(`Row ${number}: ${messages.join(', ')}`);
      else products.push(product);
    }
    if (rowErrors.length) throw new BadRequestException({ message: 'Product file validation failed', rows: rowErrors });
    if (!products.length) throw new BadRequestException('The file has no valid product rows');
    return products;
  }

  private readHeaders(row: ExcelJS.Row) {
    const names = new Map<string, keyof BulkProductRowDto>([
      ['name', 'name'], ['price', 'price'], ['costprice', 'costPrice'],
      ['quantityathand', 'quantityAtHand'], ['category', 'category'], ['minmarginpct', 'minMarginPct'],
      ['minprice', 'minPrice'], ['lowstockthreshold', 'lowStockThreshold'],
    ]);
    const result = new Map<keyof BulkProductRowDto, number>();
    row.eachCell((cell, column) => {
      const name = names.get(cell.text.trim().replace(/[\s_-]/g, '').toLowerCase());
      if (name) result.set(name, column);
    });
    return result;
  }
}
