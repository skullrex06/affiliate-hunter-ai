const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
};
const json = (data, status=200) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" }
});
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, {headers:cors});
    if (!env.DB) return json({ok:false,error:"D1 binding DB is not configured"},500);
    try {
      if (url.pathname === "/api/health" && request.method === "GET") {
        await env.DB.prepare("SELECT 1").first();
        return json({ok:true,service:"Affiliate Hunter AI API",database:"connected"});
      }
      if (url.pathname === "/api/products" && request.method === "GET") {
        const q=(url.searchParams.get("q")||"").trim();
        const category=(url.searchParams.get("category")||"").trim();
        const limit=Math.min(Math.max(Number(url.searchParams.get("limit")||100),1),500);
        let sql="SELECT * FROM products WHERE 1=1";
        const params=[];
        if(q){sql+=" AND (name LIKE ? OR category LIKE ?)";params.push("%"+q+"%","%"+q+"%");}
        if(category){sql+=" AND category = ?";params.push(category);}
        sql+=" ORDER BY created_at DESC LIMIT ?";
        params.push(limit);
        const result=await env.DB.prepare(sql).bind(...params).all();
        return json({ok:true,products:result.results||[]});
      }
      if (url.pathname === "/api/products" && request.method === "POST") {
        const body=await request.json();
        const name=String(body.name||"").trim();
        if(!name) return json({ok:false,error:"Product name is required"},400);
        const fields={
          category:String(body.category||"Other").slice(0,80),
          price:body.price==null?null:Number(body.price),
          commission_rate:body.commission_rate==null?null:Number(body.commission_rate),
          rating:body.rating==null?null:Number(body.rating),
          sold_count:body.sold_count==null?null:Number(body.sold_count),
          image_url:body.image_url?String(body.image_url).slice(0,2000):null,
          product_url:body.product_url?String(body.product_url).slice(0,2000):null,
          affiliate_url:body.affiliate_url?String(body.affiliate_url).slice(0,2000):null,
          notes:body.notes?String(body.notes).slice(0,2000):null
        };
        const result=await env.DB.prepare(
          "INSERT INTO products (name,category,price,commission_rate,rating,sold_count,image_url,product_url,affiliate_url,notes) VALUES (?,?,?,?,?,?,?,?,?,?)"
        ).bind(name,fields.category,fields.price,fields.commission_rate,fields.rating,fields.sold_count,fields.image_url,fields.product_url,fields.affiliate_url,fields.notes).run();
        return json({ok:true,id:result.meta.last_row_id},201);
      }
      if (url.pathname.startsWith("/api/products/") && request.method === "DELETE") {
        const id=Number(url.pathname.split("/").pop());
        if(!Number.isInteger(id)||id<1) return json({ok:false,error:"Invalid product id"},400);
        await env.DB.prepare("DELETE FROM products WHERE id=?").bind(id).run();
        return json({ok:true});
      }
      return json({ok:false,error:"Not found"},404);
    } catch (error) {
      return json({ok:false,error:"Server error",detail:String(error.message||error)},500);
    }
  }
};