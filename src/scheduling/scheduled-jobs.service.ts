import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { NotificationService } from 'src/notifications/notification.service';
import { ScheduledJobsRepository } from './scheduled-jobs.repository';

@Injectable()
export class ScheduledJobsService {
  private readonly logger = new Logger(ScheduledJobsService.name);
  constructor(private readonly repository: ScheduledJobsRepository, private readonly notifications: NotificationService, private readonly config: ConfigService) {}

  @Cron(process.env.CART_CLEANUP_CRON ?? '0 */5 * * * *', { name: 'abandon-stale-carts', timeZone: 'Africa/Nairobi', waitForCompletion: true })
  async abandonStaleCarts() {
    const minutes = Math.max(Number(this.config.get('CART_INACTIVITY_MINUTES') ?? 30), 5);
    const count = await this.repository.abandonStaleCarts(new Date(Date.now() - minutes * 60_000));
    this.logger.log(`Abandoned ${count} stale carts`);
  }

  @Cron(process.env.DAILY_SUMMARY_CRON ?? '0 0 20 * * *', { name: 'owner-daily-summary', timeZone: 'Africa/Nairobi', waitForCompletion: true })
  async sendOwnerDailySummary() {
    const now = new Date();
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const start = new Date(`${date}T00:00:00+03:00`);
    const end = new Date(`${date}T23:59:59.999+03:00`);
    for (const company of await this.repository.companies()) {
      const owner = company.users[0];
      if (!owner) continue;

      for (const shop of company.shops) {
        const summary = await this.repository.dailyShopSummary(
          shop.id,
          start,
          end,
        );

        await this.notifications.createForUser({
          userId: owner.id,
          shopId: shop.id,
          dedupeKey: `daily-summary:${shop.id}:${date}`,
          type: 'DAILY_SUMMARY',
          message: `${shop.name}: ${summary.sales.count} sales worth Ksh ${summary.sales.amount}; ${summary.services.count} services worth Ksh ${summary.services.amount}; expenses Ksh ${summary.expenses.amount}; ${summary.lowStock.length} low-stock products.`,
          templateName: 'owner_daily_summary',
          bodyParameters: [
            shop.name,
            date,
            String(summary.sales.count),
            summary.sales.amount,
            String(summary.services.count),
            summary.services.amount,
            summary.expenses.amount,
            String(summary.lowStock.length),
          ],
          metadata: summary,
        });
      }
    }
  }


  @Cron('0 0 20 * * *')
  async sendLowStockSummary (){
    // console.log("called")
    const now = new Date();
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    for (const company of await this.repository.companies()) {
      const owner = company.users[0];
      if (!owner) continue;

      for (const shop of company.shops) {
        const summary = await this.repository.LowStockProducts(
          shop.id
        );

        await this.notifications.createForUser({
          userId: owner.id,
          shopId: shop.id,
          dedupeKey: `lowstock-summary:${shop.id}:${date}`,
          type: 'LOW_STOCK',
          message: `${shop.name}: ${summary.length + 1} low-stock products.`,
          templateName: '',
          bodyParameters: [
            shop.name,
            date
          ],
          metadata: {},
        });
      }
    }
  }

}
