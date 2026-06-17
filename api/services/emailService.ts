import nodemailer from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

const defaultConfig: EmailConfig = {
  host: process.env.SMTP_HOST || 'smtp.qq.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE !== 'false',
  user: process.env.SMTP_USER || 'your_email@qq.com',
  pass: process.env.SMTP_PASS || 'your_auth_code',
  from: process.env.SMTP_FROM || 'Funnel Insight <your_email@qq.com>',
};

let transporter: nodemailer.Transporter | null = null;

function getTransporter(config?: Partial<EmailConfig>): nodemailer.Transporter {
  if (!transporter) {
    const finalConfig = { ...defaultConfig, ...config };
    transporter = nodemailer.createTransport({
      host: finalConfig.host,
      port: finalConfig.port,
      secure: finalConfig.secure,
      auth: {
        user: finalConfig.user,
        pass: finalConfig.pass,
      },
    });
  }
  return transporter;
}

export interface MonitorAlertEmailData {
  funnelName: string;
  stepName: string;
  currentRate: number;
  previousRate: number;
  dropPercentage: number;
  threshold: number;
  triggeredAt: string;
}

export async function sendMonitorAlertEmail(
  to: string[],
  data: MonitorAlertEmailData,
  config?: Partial<EmailConfig>
): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = getTransporter(config);
    const finalConfig = { ...defaultConfig, ...config };

    const dropColor = data.dropPercentage > 0 ? '#dc2626' : '#16a34a';
    const dropIcon = data.dropPercentage > 0 ? '📉' : '📈';
    const statusText = data.dropPercentage > 0 ? '下降' : '上升';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #3a6cf5 100%); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">⚠️ 转化率异常预警</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">Funnel Insight 监控系统</p>
        </div>
        
        <div style="background: #fef2f2; padding: 16px; border-left: 4px solid #dc2626; margin: 20px 0;">
          <p style="margin: 0; color: #991b1b; font-size: 14px;">
            <strong>检测到「${data.funnelName}」漏斗的「${data.stepName}」步骤转化率${statusText}超过阈值！</strong>
          </p>
        </div>

        <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 18px;">详细数据</h2>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">漏斗名称</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">${data.funnelName}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">监控步骤</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">${data.stepName}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">当前转化率</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #3a6cf5; font-size: 16px; font-weight: 700; text-align: right;">${data.currentRate.toFixed(2)}%</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">上次转化率</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; text-align: right;">${data.previousRate.toFixed(2)}%</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">${statusText}幅度</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; font-size: 18px; font-weight: 700; text-align: right; color: ${dropColor};">
                ${dropIcon} ${data.dropPercentage > 0 ? '-' : '+'}${Math.abs(data.dropPercentage).toFixed(2)}%
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">预警阈值</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #f97316; font-size: 14px; font-weight: 600; text-align: right;">${data.threshold}%</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">触发时间</td>
              <td style="padding: 12px 0; color: #1f2937; font-size: 14px; text-align: right;">${new Date(data.triggeredAt).toLocaleString('zh-CN')}</td>
            </tr>
          </table>

          <div style="margin-top: 24px; padding: 16px; background: #f3f4f6; border-radius: 8px;">
            <p style="margin: 0; color: #4b5563; font-size: 13px;">
              请及时登录 <a href="http://localhost:5173" style="color: #3a6cf5; text-decoration: none;">Funnel Insight</a> 查看详细分析，了解转化下降原因。
            </p>
          </div>
        </div>

        <div style="text-align: center; margin-top: 24px; color: #9ca3af; font-size: 12px;">
          <p>此邮件由 Funnel Insight 监控系统自动发送，请勿直接回复</p>
        </div>
      </div>
    `;

    const text = `
【Funnel Insight 转化率异常预警】

检测到「${data.funnelName}」漏斗的「${data.stepName}」步骤转化率${statusText}超过阈值！

详细数据：
• 漏斗名称：${data.funnelName}
• 监控步骤：${data.stepName}
• 当前转化率：${data.currentRate.toFixed(2)}%
• 上次转化率：${data.previousRate.toFixed(2)}%
• ${statusText}幅度：${data.dropPercentage > 0 ? '-' : '+'}${Math.abs(data.dropPercentage).toFixed(2)}%
• 预警阈值：${data.threshold}%
• 触发时间：${new Date(data.triggeredAt).toLocaleString('zh-CN')}

请及时登录 http://localhost:5173 查看详细分析。

此邮件由 Funnel Insight 监控系统自动发送，请勿直接回复。
    `;

    await transporter.sendMail({
      from: finalConfig.from,
      to: to.join(', '),
      subject: `⚠️ 预警：「${data.funnelName}」-${data.stepName} 转化率${statusText}${Math.abs(data.dropPercentage).toFixed(2)}%`,
      text,
      html,
    });

    return { success: true, message: '邮件发送成功' };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, message: (error as Error).message };
  }
}

export async function testEmailConnection(config?: Partial<EmailConfig>): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = getTransporter(config);
    await transporter.verify();
    return { success: true, message: '邮件服务器连接成功' };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}
