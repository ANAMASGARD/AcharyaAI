import {expect,it,vi} from 'vitest';
import {withFreshSession} from '@/lib/rag-auth-request';
it('refreshes a rejected cached token once and retries the request',async()=>{
 const getToken=vi.fn().mockResolvedValueOnce('expired').mockResolvedValueOnce('fresh');
 const send=vi.fn().mockResolvedValueOnce(new Response(null,{status:401})).mockResolvedValueOnce(new Response('{}'));
 expect((await withFreshSession(getToken,send,()=>{})).status).toBe(200);
 expect(getToken).toHaveBeenLastCalledWith({skipCache:true});expect(send).toHaveBeenLastCalledWith('fresh');
});
it('does not loop on rejected sessions or retry authorization denials',async()=>{
 const send=vi.fn(async()=>new Response(null,{status:401}));
 expect((await withFreshSession(async()=> 'token',send,()=>{})).status).toBe(401);expect(send).toHaveBeenCalledTimes(2);
 send.mockClear();send.mockImplementation(async()=>new Response(null,{status:403}));
 expect((await withFreshSession(async()=> 'token',send,()=>{})).status).toBe(403);expect(send).toHaveBeenCalledTimes(1);
});
it('does not send a refreshed token after an account switch',async()=>{
 let checks=0;const send=vi.fn(async()=>new Response(null,{status:401}));
 await expect(withFreshSession(async()=> 'token',send,()=>{if(++checks===2)throw Error('Cancelled')})).rejects.toThrow('Cancelled');expect(send).toHaveBeenCalledTimes(1);
});
