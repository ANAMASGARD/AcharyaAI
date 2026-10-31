import {expect,it,vi} from 'vitest';
import {extractSourceStep} from '@/server/rag/upload';
import {getSource,finishExtraction} from '@/server/rag/repository';
import {query} from '@/server/rag/db';
import type {Source} from '@/types/rag';
vi.mock('@/server/rag/repository',()=>({getSource:vi.fn(),finishExtraction:vi.fn(),digest:()=> 'same',beginSource:vi.fn(),claimSource:vi.fn(),failSource:vi.fn(),saveExtractionBatch:vi.fn()}));
vi.mock('@/server/rag/extraction',()=>({extractPageBatch:vi.fn(),inspectFile:vi.fn()}));
vi.mock('@/server/rag/db',()=>({query:vi.fn()}));
it('returns the saved extraction checkpoint before starting separate finalization work',async()=>{
 const source={id:'paper',kind:'paper',status:'needs_reupload',pageCount:1,extractedCount:1} as Source;
 vi.mocked(getSource).mockResolvedValue(source);
 vi.mocked(query).mockResolvedValueOnce([{files:[{id:'chapter',hash:'same',pages:1,offset:0}],attempts:0}]).mockResolvedValueOnce([{number:1,outcome:'extracted'}]);
 expect(await extractSourceStep('owner','paper',new Uint8Array([1]),'application/pdf')).toEqual(source);
 expect(finishExtraction).not.toHaveBeenCalled();
});
