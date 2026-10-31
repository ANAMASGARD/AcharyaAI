import {beforeEach,expect,it,vi} from 'vitest';
import {directReview} from '@/server/rag/direct-review';
import {query} from '@/server/rag/db';
import {structured} from '@/server/rag/openai';
import {authorizeSelections,digest} from '@/server/rag/repository';
vi.mock('@/server/rag/db',()=>({query:vi.fn()}));
vi.mock('@/server/rag/openai',()=>({structured:vi.fn()}));
vi.mock('@/server/rag/repository',async importOriginal=>({...await importOriginal<typeof import('@/server/rag/repository')>(),authorizeSelections:vi.fn()}));
const bytes=new Uint8Array([1,2,3]);
function form(){const f=new FormData();f.append('id','p'.repeat(21));f.append('selections',JSON.stringify([{documentId:'b'.repeat(21),role:'syllabus'}]));f.append('file',new Blob([bytes],{type:'image/png'}),'paper.png');return f}
beforeEach(()=>{vi.resetAllMocks();vi.mocked(query).mockResolvedValueOnce([{content_hash:digest(bytes),page_count:1,pages:[],books:[{title:'Mridang',class:'class-2',subject:'english'}]}]).mockResolvedValueOnce([{id:'r'.repeat(21)}]);vi.mocked(structured).mockResolvedValue({needsReview:false,questions:[{number:'1',text:'Question',page:1,endPage:1,sharedContext:'',marks:null,extractionCompleteness:'complete',status:'aligned',explanation:'Topic matches.',suggestion:''}]})});
it('sends the actual image and selected book metadata directly, saving an estimate without invented citations',async()=>{
 const result=await directReview('teacher',form());
 expect(authorizeSelections).toHaveBeenCalled();
 const input=JSON.stringify(vi.mocked(structured).mock.calls[0][2]);
 expect(input).toContain('data:image/png;base64,AQID');expect(input).toContain('Mridang');
 expect(result.basis).toBe('book_title_estimate');expect(result.questions[0].citations).toEqual([]);expect(result.questions[0].evidenceSupport).toBe('insufficient');
});
it('rejects another file before sending it to OpenAI',async()=>{
 const f=form();f.set('file',new Blob(['other'],{type:'image/png'}));await expect(directReview('teacher',f)).rejects.toMatchObject({status:409});expect(structured).not.toHaveBeenCalled();
});
it('requires an owned readable paper',async()=>{
 vi.mocked(query).mockReset().mockResolvedValueOnce([]);await expect(directReview('other',form())).rejects.toMatchObject({status:404});expect(structured).not.toHaveBeenCalled();
});
it('does not assign syllabus alignment without a syllabus selection',async()=>{
 const f=form();f.set('selections','[]');const result=await directReview('teacher',f);expect(result.questions[0].status).toBe('needs_review');
});

it('permits an unextracted paper with its original image, without requiring publication',async()=>{
 await directReview('teacher',form());
 expect(vi.mocked(query).mock.calls[0][0]).not.toContain("d.status='ready'");
});
it('requires original bytes when no saved text exists',async()=>{
 const f=form();f.delete('file');await expect(directReview('teacher',f)).rejects.toMatchObject({status:409});expect(structured).not.toHaveBeenCalled();
});
