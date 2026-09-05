import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { analyzeProduct } from '@/lib/ai-analyzer';
import { isDailyDataFilename } from '@/lib/storage';
import { loadCorpus, mergeCorpusProduct, auditCorpus } from '@/lib/corpus';
import { countEnrichmentBacklog, selectEnrichmentBacklog } from '@/lib/enrichment-backlog';
import type { PHComment, Product } from '@/types';

const DATA_DIR=path.join(process.cwd(),'data');
const CORPUS_FILE=path.join(DATA_DIR,'corpus.json');
const HEALTH_FILE=path.join(DATA_DIR,'enrichment-health.json');
const PH_API='https://api.producthunt.com/v2/api/graphql';
const DELAY=Number(process.env.ENRICH_DELAY_MS??'12000');
const LIMIT=Number(process.env.ENRICH_BACKLOG_LIMIT??'10');
const KEYS=['today','yesterday','week','month','year'] as const;

function stripHtml(html:string){return html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();}
async function fetchComments(token:string,slug:string):Promise<PHComment[]>{
  const query=`query { post(slug: "${slug}") { comments(first: 8) { edges { node { body user { name username } } } } } }`;
  const res=await fetch(PH_API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,'User-Agent':'IdehJo/3.0 (+https://idehjo.ir)'},body:JSON.stringify({query})});
  if(!res.ok) return [];
  const json:any=await res.json();
  return (json.data?.post?.comments?.edges??[]).map((e:any)=>({user:e.node?.user?.name||e.node?.user?.username||'',text:stripHtml(e.node?.body??'')})).filter((c:PHComment)=>c.text.length>10);
}
function propagate(data:any,slug:string,src:Product){
  for(const k of KEYS) for(const t of data.periods[k]??[]) if(t.slug===slug) Object.assign(t,mergeCorpusProduct(t,src));
}

async function main(){
  const token=process.env.PH_API_TOKEN;
  if(!Number.isFinite(LIMIT)||LIMIT<1||LIMIT>20) throw new Error(`invalid ENRICH_BACKLOG_LIMIT: ${LIMIT}`);
  const files=(await readdir(DATA_DIR)).filter(isDailyDataFilename).sort().reverse();
  if(!files.length) throw new Error('no daily data');
  const latestName=files[0], file=path.join(DATA_DIR,latestName);
  const data=JSON.parse(await readFile(file,'utf8'));
  const corpus=await loadCorpus();
  const before=countEnrichmentBacklog(corpus.products);
  const corpusMap=new Map<string,Product>(corpus.products.map(p=>[p.slug,p]));
  const targets=selectEnrichmentBacklog(corpus.products,LIMIT);

  let attempted=0,succeeded=0,failed=0;
  const failures:Array<{slug:string;reason:string}>=[];
  for(const {product,completeness} of targets){
    attempted++;
    try{
      const working=structuredClone(product);
      const hasStoredComments=(working.comments??[]).some(c=>c.text?.trim().length>10);
      if(!completeness.faComments && !hasStoredComments){
        if(!token) throw new Error('PH_API_TOKEN missing for product without stored source comments');
        const fresh=await fetchComments(token,product.slug);
        if(fresh.length) working.comments=fresh;
      }
      const ai=await analyzeProduct(working,{
        faDescription:!completeness.faDescription,
        faComments:!completeness.faComments,
        aiReview:!completeness.aiReview,
        iranEquivalent:!completeness.iranEquivalent,
      });
      if(!completeness.faDescription && ai.faDescription?.trim()) working.faDescription=ai.faDescription;
      if(!completeness.faComments && ai.faComments?.length) working.faComments=ai.faComments;
      if(!completeness.aiReview && ai.aiReview?.trim()) working.aiReview=ai.aiReview;
      if(!completeness.iranEquivalent && ai.iranEquivalent) working.iranEquivalent=ai.iranEquivalent;
      const merged=mergeCorpusProduct(corpusMap.get(product.slug),working);
      corpusMap.set(product.slug,merged); propagate(data,product.slug,merged); succeeded++;
    }catch(e){failed++; const reason=e instanceof Error?e.message:String(e); failures.push({slug:product.slug,reason:reason.slice(0,240)});}
    if(DELAY>0) await new Promise(r=>setTimeout(r,DELAY));
  }

  const products=[...corpusMap.values()].sort((a,b)=>(b.votes??0)-(a.votes??0));
  const updated={...corpus,generatedAt:new Date().toISOString(),products,audit:auditCorpus(products)};
  const after=countEnrichmentBacklog(products);
  await writeFile(file,JSON.stringify(data,null,2),'utf8');
  await writeFile(CORPUS_FILE,JSON.stringify(updated,null,2),'utf8');
  await writeFile(HEALTH_FILE,JSON.stringify({
    checkedAt:new Date().toISOString(),latestDataset:latestName,batchLimit:LIMIT,attempted,succeeded,failed,
    backlogBefore:before.backlog,backlogAfter:after.backlog,completedProducts:after.complete,
    missingFaDescription:after.missingFaDescription,missingFaComments:after.missingFaComments,
    missingAiReview:after.missingAiReview,missingIranEquivalent:after.missingIranEquivalent,failures
  },null,2),'utf8');

  console.log(`📊 Enrichment backlog ${before.backlog} -> ${after.backlog}; success ${succeeded}/${attempted}; failed ${failed}`);
}
main().catch(e=>{console.error('❌ enrichment failed:',e instanceof Error?e.message:e);process.exit(1);});
