import type { SkillEdge, SkillKind } from '@skillx/shared';

export interface CatalogSkill {
  id: string;
  name: string;
  kind: SkillKind;
}

export interface DomainCatalog {
  domain: string;
  label: string;
  skills: CatalogSkill[];
  edges: SkillEdge[];
}

/**
 * Seed graphs per core domain. The AI starts from the core skills and uses
 * the related skills/tools to ask contextual follow-ups, which validates the
 * supplementary stack implicitly instead of quizzing it item by item.
 */
const CATALOGS: DomainCatalog[] = [
  {
    domain: 'backend',
    label: 'Backend engineering',
    skills: [
      { id: 'api_design', name: 'API design', kind: 'core' },
      { id: 'databases', name: 'Databases & data modelling', kind: 'core' },
      { id: 'concurrency', name: 'Concurrency & async', kind: 'core' },
      { id: 'caching', name: 'Caching', kind: 'related' },
      { id: 'observability', name: 'Logging & observability', kind: 'related' },
      { id: 'security', name: 'AuthN/AuthZ & security', kind: 'related' },
      { id: 'testing', name: 'Automated testing', kind: 'related' },
      { id: 'sql', name: 'SQL', kind: 'tool' },
      { id: 'redis', name: 'Redis', kind: 'tool' },
      { id: 'docker', name: 'Docker', kind: 'tool' },
      { id: 'message_queues', name: 'Message queues (Kafka/RabbitMQ)', kind: 'tool' },
    ],
    edges: [
      { from: 'databases', to: 'sql', relation: 'uses' },
      { from: 'caching', to: 'redis', relation: 'uses' },
      { from: 'api_design', to: 'security', relation: 'related_to' },
      { from: 'api_design', to: 'caching', relation: 'related_to' },
      { from: 'concurrency', to: 'message_queues', relation: 'uses' },
      { from: 'observability', to: 'docker', relation: 'related_to' },
      { from: 'api_design', to: 'testing', relation: 'related_to' },
    ],
  },
  {
    domain: 'frontend',
    label: 'Frontend engineering',
    skills: [
      { id: 'ui_architecture', name: 'UI architecture & state', kind: 'core' },
      { id: 'javascript', name: 'JavaScript/TypeScript', kind: 'core' },
      { id: 'web_performance', name: 'Web performance', kind: 'core' },
      { id: 'accessibility', name: 'Accessibility', kind: 'related' },
      { id: 'css_layout', name: 'CSS & layout', kind: 'related' },
      { id: 'testing', name: 'Component testing', kind: 'related' },
      { id: 'react', name: 'React', kind: 'tool' },
      { id: 'bundlers', name: 'Bundlers (Vite/webpack)', kind: 'tool' },
      { id: 'browser_devtools', name: 'Browser DevTools', kind: 'tool' },
    ],
    edges: [
      { from: 'ui_architecture', to: 'react', relation: 'uses' },
      { from: 'web_performance', to: 'bundlers', relation: 'uses' },
      { from: 'web_performance', to: 'browser_devtools', relation: 'uses' },
      { from: 'ui_architecture', to: 'testing', relation: 'related_to' },
      { from: 'css_layout', to: 'accessibility', relation: 'related_to' },
    ],
  },
  {
    domain: 'data',
    label: 'Data engineering & analytics',
    skills: [
      { id: 'data_modelling', name: 'Data modelling', kind: 'core' },
      { id: 'pipelines', name: 'Pipelines & ETL', kind: 'core' },
      { id: 'statistics', name: 'Statistics', kind: 'core' },
      { id: 'data_quality', name: 'Data quality', kind: 'related' },
      { id: 'orchestration', name: 'Orchestration', kind: 'related' },
      { id: 'sql', name: 'SQL', kind: 'tool' },
      { id: 'python', name: 'Python (pandas)', kind: 'tool' },
      { id: 'spark', name: 'Spark', kind: 'tool' },
      { id: 'airflow', name: 'Airflow/Dagster', kind: 'tool' },
    ],
    edges: [
      { from: 'data_modelling', to: 'sql', relation: 'uses' },
      { from: 'pipelines', to: 'spark', relation: 'uses' },
      { from: 'pipelines', to: 'orchestration', relation: 'related_to' },
      { from: 'orchestration', to: 'airflow', relation: 'uses' },
      { from: 'statistics', to: 'python', relation: 'uses' },
      { from: 'pipelines', to: 'data_quality', relation: 'related_to' },
    ],
  },
  {
    domain: 'devops',
    label: 'DevOps & platform',
    skills: [
      { id: 'ci_cd', name: 'CI/CD', kind: 'core' },
      { id: 'infrastructure', name: 'Infrastructure as code', kind: 'core' },
      { id: 'reliability', name: 'Reliability & incident response', kind: 'core' },
      { id: 'networking', name: 'Networking', kind: 'related' },
      { id: 'observability', name: 'Monitoring & alerting', kind: 'related' },
      { id: 'kubernetes', name: 'Kubernetes', kind: 'tool' },
      { id: 'terraform', name: 'Terraform', kind: 'tool' },
      { id: 'docker', name: 'Docker', kind: 'tool' },
    ],
    edges: [
      { from: 'infrastructure', to: 'terraform', relation: 'uses' },
      { from: 'ci_cd', to: 'docker', relation: 'uses' },
      { from: 'reliability', to: 'observability', relation: 'related_to' },
      { from: 'reliability', to: 'kubernetes', relation: 'related_to' },
      { from: 'infrastructure', to: 'networking', relation: 'related_to' },
    ],
  },
];

export const SUPPORTED_DOMAINS = CATALOGS.map((c) => ({ domain: c.domain, label: c.label }));

export function catalogFor(domain: string): DomainCatalog {
  const normalized = domain.trim().toLowerCase();
  return CATALOGS.find((c) => c.domain === normalized) ?? CATALOGS[0];
}
