import { getDatabase } from './database.js';
import { v4 as uuidv4 } from 'uuid';

const EVENTS = [
  'page_view',
  'register',
  'complete_profile',
  'browse_products',
  'search_product',
  'view_product',
  'add_to_cart',
  'view_cart',
  'start_checkout',
  'submit_order',
  'payment_success',
  'app_open',
  'share_content',
];

const CHANNELS = ['自然搜索', '广告投放', '社交媒体', '直接访问', '推荐邀请'];
const CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '重庆', '西安'];
const USER_LEVELS = ['普通用户', 'VIP会员', '超级会员', '新用户'];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function randomDate(daysAgo: number): Date {
  const now = new Date();
  const past = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const randomTime = past.getTime() + Math.random() * (now.getTime() - past.getTime());
  return new Date(randomTime);
}

export function generateMockData() {
  const db = getDatabase();
  
  const userCountStmt = db.prepare('SELECT COUNT(*) as count FROM user_attributes');
  const { count } = userCountStmt.get() as { count: number };
  if (count > 0) {
    console.log('Mock data already exists, skipping generation');
    return;
  }

  console.log('Generating mock data...');
  
  const userCount = 2000;
  const users: { id: string; registerDate: Date; channel: string; city: string; level: string }[] = [];

  const insertUser = db.prepare(`
    INSERT INTO user_attributes (user_id, channel, city, register_date, user_level)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertEvent = db.prepare(`
    INSERT INTO event_logs (id, user_id, event_name, event_time, properties)
    VALUES (?, ?, ?, ?, ?)
  `);

  const userInsertTx = db.transaction(() => {
    for (let i = 0; i < userCount; i++) {
      const userId = uuidv4();
      const registerDate = randomDate(90);
      const channel = randomChoice(CHANNELS);
      const city = randomChoice(CITIES);
      const level = randomChoice(USER_LEVELS);
      
      users.push({ id: userId, registerDate, channel, city, level });
      insertUser.run(userId, channel, city, registerDate.toISOString().split('T')[0], level);
    }
  });
  userInsertTx();

  let totalEvents = 0;
  const eventInsertTx = db.transaction(() => {
    for (const user of users) {
      const rand = Math.random();
      let userPath: string[] = [];
      
      if (rand < 0.1) {
        userPath = ['app_open', 'page_view'];
      } else if (rand < 0.25) {
        userPath = ['app_open', 'page_view', 'register'];
      } else if (rand < 0.4) {
        userPath = ['app_open', 'page_view', 'register', 'complete_profile'];
      } else if (rand < 0.6) {
        userPath = ['app_open', 'page_view', 'register', 'complete_profile', 'browse_products', 'view_product'];
      } else if (rand < 0.75) {
        userPath = ['app_open', 'page_view', 'register', 'complete_profile', 'browse_products', 'view_product', 'add_to_cart'];
      } else if (rand < 0.85) {
        userPath = ['app_open', 'page_view', 'register', 'complete_profile', 'browse_products', 'view_product', 'add_to_cart', 'start_checkout', 'submit_order'];
      } else {
        userPath = ['app_open', 'page_view', 'register', 'complete_profile', 'browse_products', 'view_product', 'add_to_cart', 'start_checkout', 'submit_order', 'payment_success'];
      }

      let eventTime = new Date(user.registerDate.getTime());
      
      for (let session = 0; session < randomInt(1, 8); session++) {
        const sessionStart = new Date(eventTime.getTime() + randomInt(1, 72) * 60 * 60 * 1000);
        let currentTime = sessionStart;
        
        const sessionEvents = session === 0 ? userPath.slice(0, randomInt(2, userPath.length)) : [
          'app_open', 'page_view', ...(randomInt(0, 1) ? ['browse_products', 'view_product'] : []),
          ...(randomInt(0, 1) ? ['search_product'] : []),
        ];

        for (const eventName of sessionEvents) {
          const props: Record<string, unknown> = {};
          if (eventName === 'view_product') {
            props.product_id = `prod_${randomInt(1, 500)}`;
            props.category = randomChoice(['数码', '服装', '食品', '家居', '美妆']);
          } else if (eventName === 'search_product') {
            props.keyword = randomChoice(['手机', '衣服', '零食', '杯子', '护肤品']);
          }
          
          insertEvent.run(
            uuidv4(),
            user.id,
            eventName,
            currentTime.toISOString(),
            JSON.stringify(props)
          );
          totalEvents++;
          
          currentTime = new Date(currentTime.getTime() + randomInt(10, 600) * 1000);
        }
        
        eventTime = currentTime;
      }
    }
  });
  eventInsertTx();

  const funnelData = [
    {
      name: '注册转化漏斗',
      description: '从访问到完成注册的转化漏斗',
      steps: [
        { name: '访问APP', event: 'app_open' },
        { name: '浏览页面', event: 'page_view' },
        { name: '用户注册', event: 'register' },
        { name: '完善资料', event: 'complete_profile' },
      ],
    },
    {
      name: '购买转化漏斗',
      description: '从浏览商品到支付成功的转化漏斗',
      steps: [
        { name: '浏览商品', event: 'browse_products' },
        { name: '查看商品', event: 'view_product' },
        { name: '加入购物车', event: 'add_to_cart' },
        { name: '开始结算', event: 'start_checkout' },
        { name: '提交订单', event: 'submit_order' },
        { name: '支付成功', event: 'payment_success' },
      ],
    },
    {
      name: '用户活跃漏斗',
      description: '用户深度使用行为漏斗',
      steps: [
        { name: '打开APP', event: 'app_open' },
        { name: '浏览内容', event: 'page_view' },
        { name: '搜索商品', event: 'search_product' },
        { name: '分享内容', event: 'share_content' },
      ],
    },
  ];

  const insertFunnel = db.prepare(`
    INSERT INTO funnels (id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertStep = db.prepare(`
    INSERT INTO funnel_steps (id, funnel_id, name, event_name, order_index)
    VALUES (?, ?, ?, ?, ?)
  `);

  const funnelInsertTx = db.transaction(() => {
    for (const funnel of funnelData) {
      const funnelId = uuidv4();
      const now = new Date().toISOString();
      insertFunnel.run(funnelId, funnel.name, funnel.description, now, now);
      
      funnel.steps.forEach((step, index) => {
        insertStep.run(uuidv4(), funnelId, step.name, step.event, index);
      });
    }
  });
  funnelInsertTx();

  const monitorData = [
    {
      funnelIndex: 1,
      stepIndex: 3,
      stepName: '加入购物车',
      threshold: 10,
      frequency: 'daily',
      emails: ['ops@example.com', 'pm@example.com'],
    },
    {
      funnelIndex: 0,
      stepIndex: 2,
      stepName: '用户注册',
      threshold: 15,
      frequency: 'daily',
      emails: ['growth@example.com'],
    },
  ];

  const funnelIds = db.prepare('SELECT id, name FROM funnels ORDER BY created_at').all() as { id: string; name: string }[];
  
  const insertMonitor = db.prepare(`
    INSERT INTO monitor_rules (id, funnel_id, funnel_name, step_index, step_name, threshold, frequency, enabled, notify_emails, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  const monitorInsertTx = db.transaction(() => {
    for (const monitor of monitorData) {
      const funnel = funnelIds[monitor.funnelIndex];
      insertMonitor.run(
        uuidv4(),
        funnel.id,
        funnel.name,
        monitor.stepIndex,
        monitor.stepName,
        monitor.threshold,
        monitor.frequency,
        JSON.stringify(monitor.emails),
        new Date().toISOString()
      );
    }
  });
  monitorInsertTx();

  console.log(`Mock data generated: ${userCount} users, ${totalEvents} events, ${funnelData.length} funnels, ${monitorData.length} monitor rules`);
}

export default generateMockData;
