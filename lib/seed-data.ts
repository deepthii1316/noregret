import type { FlexItem } from './schedule'

const WD = [1, 2, 3, 4, 5]
const SAT = [6]
const SUN = [0]

export type SeedBlock = {
  slug: string; key?: string; title: string; subject: string; start: string; end: string
  days: number[]; kind: 'habit' | 'meal' | 'chore' | 'study' | 'break' | 'flex'; study?: boolean
  flex?: Record<string, FlexItem[]>
}

const ML_WEB: FlexItem[] = [{ title: 'ML', subject: 'ML', minutes: 120 }, { title: 'Web Dev', subject: 'Web Dev', minutes: 30 }]
const b = (slug: string, title: string, start: string, end: string, days: number[], kind: SeedBlock['kind'], subject = 'Other', extra: Partial<SeedBlock> = {}): SeedBlock =>
  ({ slug, title, subject, start, end, days, kind, study: kind === 'study', ...extra })

export const SCHEDULE: SeedBlock[] = [
  // Weekdays
  b('wd-wake', 'Wake, make bed, fill bottle, water for mom, purifier, sunscreen', '07:00', '07:30', WD, 'habit'),
  b('wd-exercise', 'Exercise outside (also sunlight)', '07:30', '08:30', WD, 'habit', 'Other', { key: 'exercise' }),
  b('wd-breakfast', 'Shower, breakfast with soaked nuts', '08:30', '09:00', WD, 'meal'),
  b('wd-dsa', 'DSA (3h with a 15-min break)', '09:00', '12:15', WD, 'study', 'DSA', { key: 'dsa' }),
  b('wd-veg1', 'Veggies with mom, wash rice and put in cooker', '12:15', '12:45', WD, 'chore'),
  b('wd-lunch', 'Lunch (1 egg), short rest', '12:45', '13:30', WD, 'meal'),
  b('wd-sql', 'SQL', '13:30', '14:30', WD, 'study', 'SQL'),
  b('wd-apt', 'Aptitude', '14:30', '15:30', WD, 'study', 'Aptitude'),
  b('wd-break', 'Break, refill water', '15:30', '15:45', WD, 'break'),
  b('wd-jobs', 'Job hunt + cold emails', '15:45', '16:45', WD, 'study', 'Other', { key: 'jobs' }),
  b('wd-aws', 'AWS (2h)', '16:45', '18:45', WD, 'study', 'AWS'),
  b('wd-fruit', 'Cut fruit for mom, break', '18:45', '19:15', WD, 'chore'),
  b('wd-dinner', 'Veggies with mom, dinner', '19:15', '20:15', WD, 'chore'),
  b('wd-flex', 'Flex block (2.5h)', '20:15', '22:45', WD, 'flex', 'Other', {
    study: true,
    flex: {
      '1': ML_WEB, '3': ML_WEB, '5': ML_WEB,
      '2': [{ title: 'Projects / Open Source', subject: 'Projects', minutes: 150 }],
      '4': [{ title: 'Web Dev', subject: 'Web Dev', minutes: 60 }, { title: 'Explore slot', subject: 'Explore', minutes: 90 }],
    },
  }),
  b('wd-night', 'Fill purifier, make bed, soak nuts, night check, sleep', '22:45', '23:00', WD, 'habit'),

  // Saturday
  b('sa-morning', 'Morning routine, exercise, shower and breakfast', '07:00', '09:00', SAT, 'habit', 'Other', { key: 'exercise' }),
  b('sa-contest', 'Contest first, then upsolve', '09:00', '12:30', SAT, 'study', 'Contest'),
  b('sa-lunch', 'Lunch (1 egg), veggies with mom, wash rice', '12:30', '13:30', SAT, 'meal'),
  b('sa-aws', 'AWS practice test (2h)', '13:30', '15:30', SAT, 'study', 'AWS'),
  b('sa-break', 'Break', '15:30', '15:45', SAT, 'break'),
  b('sa-proj', 'Projects / Open Source (2h)', '15:45', '17:45', SAT, 'study', 'Projects'),
  b('sa-jobs', 'Job hunt + cold emails', '17:45', '18:45', SAT, 'study', 'Other', { key: 'jobs' }),
  b('sa-sql', 'SQL (1h)', '19:00', '20:00', SAT, 'study', 'SQL'),
  b('sa-dinner', 'Fruit for mom, veggies, dinner', '20:00', '21:00', SAT, 'chore'),
  b('sa-night', 'Bedtime routine, night check, sleep', '22:45', '23:00', SAT, 'habit'),

  // Sunday
  b('su-morning', 'Morning routine, exercise, shower and breakfast', '07:00', '09:00', SUN, 'habit', 'Other', { key: 'exercise' }),
  b('su-contest', 'Contest first, then upsolve', '09:00', '12:30', SUN, 'study', 'Contest'),
  b('su-lunch', 'Lunch (1 egg), veggies with mom, wash rice', '12:30', '13:30', SUN, 'meal'),
  b('su-ml', 'ML (2h)', '13:30', '15:30', SUN, 'study', 'ML'),
  b('su-break', 'Break', '15:30', '15:45', SUN, 'break'),
  b('su-explore', 'Explore + Medium blog (1.5h)', '15:45', '17:15', SUN, 'study', 'Explore'),
  b('su-jobs', 'Job hunt + cold emails', '17:15', '18:15', SUN, 'study', 'Other', { key: 'jobs' }),
  b('su-sql', 'SQL (1h)', '18:30', '19:30', SUN, 'study', 'SQL'),
  b('su-dinner', 'Fruit for mom, veggies, dinner', '19:30', '20:30', SUN, 'chore'),
  b('su-review', 'Weekly review (20 min)', '20:30', '20:50', SUN, 'study', 'Other', { key: 'weekly-review' }),
  b('su-night', 'Bedtime routine, night check, sleep', '22:45', '23:00', SUN, 'habit'),
]

export type SeedHabit = { slug: string; name: string; type: 'checkbox' | 'counter' | 'duration' | 'time'; target?: number; unit?: string; category: 'health' | 'home' }
export const HABITS: SeedHabit[] = [
  { slug: 'exercise', name: 'Exercise', type: 'duration', target: 60, unit: 'min', category: 'health' },
  { slug: 'water', name: 'Water', type: 'counter', target: 2500, unit: 'ml', category: 'health' },
  { slug: 'sunscreen', name: 'Sunscreen', type: 'checkbox', category: 'health' },
  { slug: 'sunlight', name: 'Sunlight', type: 'checkbox', category: 'health' },
  { slug: 'nuts', name: 'Soaked nuts', type: 'checkbox', category: 'health' },
  { slug: 'egg', name: 'Egg (lunch)', type: 'checkbox', category: 'health' },
  { slug: 'sleep', name: 'Sleep (bed 23:00, wake 07:00)', type: 'time', target: 7, unit: 'h', category: 'health' },
  { slug: 'bed-am', name: 'Make bed (AM)', type: 'checkbox', category: 'health' },
  { slug: 'bed-pm', name: 'Make bed (PM)', type: 'checkbox', category: 'health' },
  { slug: 'purifier-am', name: 'Purifier (AM)', type: 'checkbox', category: 'health' },
  { slug: 'purifier-pm', name: 'Purifier (PM)', type: 'checkbox', category: 'health' },
  { slug: 'home-rice', name: 'Wash rice, put in cooker', type: 'checkbox', category: 'home' },
  { slug: 'home-water', name: 'Water for mom', type: 'checkbox', category: 'home' },
  { slug: 'home-veg-lunch', name: 'Help with veggies (lunch)', type: 'checkbox', category: 'home' },
  { slug: 'home-veg-dinner', name: 'Help with veggies (dinner)', type: 'checkbox', category: 'home' },
  { slug: 'home-fruit', name: 'Cut fruit bowl (evening)', type: 'checkbox', category: 'home' },
]

const list = (s: string) => s.split(';').map((x) => x.trim()).filter(Boolean)
export type SeedTracker = { key: string; name: string; icon: string; groups: { name: string; items: string[] }[] }
export const TRACKERS: SeedTracker[] = [
  {
    key: 'aptitude', name: 'Aptitude', icon: 'Calculator', groups: [
      { name: 'Quantitative Aptitude', items: list('Numbers, Decimals, Fractions & Powers; LCM & HCF; Divisibility & Remainders; Surds & Indices; Ratio & Proportion; Averages; Percentages; Profit & Loss; Discounts; Simple Interest; Compound Interest; Partnership; Mixtures & Alligation; Time & Work; Pipes & Cisterns; Time, Speed & Distance; Trains; Boats & Streams; Ages; Algebra; Logarithms; Permutation & Combination; Probability; Statistics; Geometry; Coordinate Geometry; Mensuration; Data Interpretation; Data Sufficiency (Quant); Clocks; Calendar') },
      { name: 'Logical Reasoning', items: list('Number Series; Letter & Alphanumeric Series; Coding-Decoding; Syllogism; Blood Relations; Direction Sense; Linear Seating Arrangement; Circular Seating Arrangement; Puzzles; Order & Ranking; Input-Output; Venn Diagrams; Data Sufficiency (Reasoning); Assertion & Reason; Statement-Based Reasoning; Non-verbal Reasoning') },
      { name: 'Verbal Ability & English', items: list('Reading Comprehension; Error Spotting; Sentence Correction; Fill in the Blanks; Cloze Test; Para Jumbles; Synonyms & Antonyms; One-word Substitution; True / False / Cannot Say; Critical Reasoning; Sentence Completion') },
    ],
  },
  {
    key: 'sql', name: 'SQL', icon: 'Database', groups: [
      { name: 'SQL topics', items: list('SELECT, WHERE, ORDER BY, LIMIT; Aggregations (COUNT/SUM/AVG/GROUP BY); HAVING vs WHERE; JOINs (INNER/LEFT/RIGHT/FULL/SELF); Subqueries & nested queries; Window functions (ROW_NUMBER/RANK/DENSE_RANK/LAG/LEAD); CTEs (WITH clause); CASE statements; UNION / INTERSECT / EXCEPT; String & date functions; Second highest salary / employees earning more than their manager; Delete duplicate rows') },
    ],
  },
  {
    key: 'webdev', name: 'Web Dev', icon: 'Globe', groups: [
      { name: 'HTML & CSS', items: list('Semantic HTML; Forms and validation attributes; Box model; Flexbox; Grid; Responsive design; Selectors and specificity') },
      { name: 'JavaScript', items: list('Variables, types, operators; Functions and arrow functions; DOM manipulation; Events; Array and object methods; fetch and async/await') },
      { name: 'React', items: list('JSX and components; Props and state; Lists and keys; Handling events; useEffect; Controlled forms') },
      { name: 'Backend basics', items: list('Node/Express or Next route handlers; REST; Auth basics; SQL with an ORM') },
    ],
  },
  {
    key: 'cs', name: 'CS Fundamentals', icon: 'Cpu', groups: [
      { name: 'Operating Systems', items: list('Process vs Thread; CPU Scheduling; Deadlock; Process synchronization / semaphores; Memory management and paging; Virtual memory and page replacement; Context switching') },
      { name: 'DBMS', items: list('ER model and keys; Normalization (1NF-BCNF); Transactions and ACID; Concurrency control and locks; Indexing (B-tree/hash); Joins and query execution; CAP theorem / SQL vs NoSQL') },
      { name: 'Computer Networks', items: list('OSI vs TCP/IP; TCP vs UDP; IP addressing and subnetting; DNS, DHCP, ARP; HTTP/HTTPS and status codes; Routing and switching basics') },
      { name: 'OOPs', items: list('Four pillars; Overloading vs overriding; Abstract class vs interface; SOLID basics') },
    ],
  },
  {
    key: 'interview', name: 'Interview Prep', icon: 'MessagesSquare', groups: [
      { name: 'Technical interview', items: list('Project walk-through (1-minute overview, role, stack, one challenge); OOP basics; DBMS basics; Live coding warm-ups (palindrome, Fibonacci, string reverse); DSA concepts (array vs linked list, stack vs queue, sort complexities); Web basics; OS basics; Cloud/DevOps basics') },
      { name: 'HR interview', items: list('Tell me about yourself; Strengths and weaknesses; Deadline-slipping scenario (STAR); Team conflict story (STAR); 5-year goals; Questions to ask the panel') },
    ],
  },
  {
    key: 'aws', name: 'AWS', icon: 'Cloud', groups: [
      { name: 'Compute', items: list('EC2; Lambda; ECS and EKS; Auto Scaling; Load Balancing') },
      { name: 'Storage', items: list('S3; EBS and EFS; S3 storage classes; Backup and lifecycle policies') },
      { name: 'Networking and VPC', items: list('VPC; Subnets and route tables; Security groups and NACLs; Route 53; CloudFront') },
      { name: 'IAM and security', items: list('IAM users, roles and policies; KMS; Secrets Manager; Shared responsibility model') },
      { name: 'Databases', items: list('RDS; DynamoDB; ElastiCache; Database backups and scaling') },
      { name: 'Serverless and integration', items: list('API Gateway; Step Functions; SQS and SNS; EventBridge') },
      { name: 'Monitoring and cost', items: list('CloudWatch; CloudTrail; Cost Explorer; Budgets and cost optimization') },
      { name: 'High availability', items: list('Multi-AZ design; Disaster recovery; Well-Architected Framework') },
    ],
  },
  {
    key: 'ml', name: 'Machine Learning', icon: 'Brain', groups: [
      { name: 'Foundations', items: list('Python, NumPy and Pandas; Statistics and probability') },
      { name: 'Models', items: list('Linear and logistic regression; Trees and ensembles; Model evaluation and validation') },
      { name: 'Advanced topics', items: list('Neural network basics; Basic NLP') },
      { name: 'Practice', items: list('Mini-project ideas') },
    ],
  },
  {
    key: 'projects', name: 'Projects & Open Source', icon: 'Code', groups: [
      { name: 'Project pipeline', items: list('Ideas; Building; Shipped') },
      { name: 'Open source', items: list('Find a good first issue; Explore a contribution; Submit a pull request; Get a contribution merged') },
    ],
  },
]

export const EXPLORE_TOPICS = [
  'Salesforce',
  'MongoDB',
  'Claude',
  'Forward-Deployed Engineer (what it means)',
  'Web crawling',
  'Cybersecurity & security',
]

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
