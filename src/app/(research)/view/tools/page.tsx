import { redirect } from 'next/navigation';

import { RESEARCH_ENTRY_HREF } from '@/components/research/research-catalog';

/** 工具一览已撤下，旧地址进入第一件工具。 */
export default function RetiredToolsPage(): never {
  redirect(RESEARCH_ENTRY_HREF);
}
