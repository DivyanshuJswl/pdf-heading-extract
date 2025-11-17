from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
import fitz
import tempfile
import os
import json
import re
import time
import numpy as np

app = FastAPI()

# CORS - Allow your Vercel domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update with your Vercel URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paste all your PDF extraction functions here
def extract_text_from_line(line):
    return "".join(span["text"] for span in line.get("spans", []))

def get_font_features(span):
    return {
        "size": span.get("size", 0),
        "font": span.get("font", "").lower(),
        "color": span.get("color", 0),
        "flags": span.get("flags", 0)
    }

def is_bold(font_name):
    return any(weight in font_name for weight in ["bold", "semibold", "medium", "black"])

def get_page_font_stats(lines):
    sizes = []
    y_positions = []
    
    for line in lines:
        if line.get("spans"):
            max_span = max(line["spans"], key=lambda s: s.get("size", 0))
            sizes.append(max_span.get("size", 0))
            y_positions.append(line["bbox"][1])
    
    if not sizes:
        return {"avg_font_size": 0, "std_font_size": 0, "avg_spacing": 0}
    
    spacing = np.diff(sorted(y_positions)) if len(y_positions) > 1 else [0]
    return {
        "avg_font_size": np.mean(sizes) if sizes else 0,
        "std_font_size": np.std(sizes) if sizes else 0,
        "avg_spacing": np.mean(spacing) if len(spacing) > 0 else 0
    }

def is_likely_heading(line, prev_y, stats, page_width=595):
    if not line.get("spans"):
        return False
    
    spans = line["spans"]
    text = extract_text_from_line(line).strip()
    text = re.sub(r'\s+', ' ', text).strip()
    
    if not text or len(text.split()) > 12 or len(text) < 2:
        return False
    
    if (text.endswith('.') or text.endswith(',') or text.endswith(':') or 
        text.startswith('•') or text.isdigit()):
        return False
    
    char_count = len(text)
    digit_count = sum(1 for c in text if c.isdigit())
    if char_count > 0 and digit_count / char_count > 0.3:
        return False
    
    span = max(spans, key=lambda s: s.get("size", 0))
    font = get_font_features(span)
    size = font["size"]
    bold = is_bold(font["font"]) or bool(font["flags"] & 16)
    caps = text.isupper()
    title_case = text.istitle()
    short = len(text) <= 50
    
    z_score = (size - stats["avg_font_size"]) / (stats["std_font_size"] + 1e-5) if stats["std_font_size"] else 0
    
    bbox = line["bbox"]
    centered = abs((bbox[0] + bbox[2]) / 2 - page_width/2) < 50
    whitespace_above = bbox[1] - prev_y if prev_y else 0
    spacious = whitespace_above > stats["avg_spacing"] * 1.2 if stats["avg_spacing"] else False
    
    score = 0
    score += 3 if z_score > 1.5 else (2 if z_score > 1.0 else 0)
    score += 2 if bold else 0
    score += 1.5 if centered else 0
    score += 1.5 if spacious else 0
    score += 1 if caps or title_case else 0
    score += 1 if short else 0
    
    return score >= 6

def extract_title(page):
    title_candidates = []
    blocks = page.get_text("dict")["blocks"]
    all_lines = []
    
    for block in blocks:
        for line in block.get("lines", []):
            all_lines.append(line)
    
    if not all_lines:
        return ""
    
    stats = get_page_font_stats(all_lines)
    prev_y = None
    
    for block in blocks:
        for line in block.get("lines", []):
            spans = line["spans"]
            if not spans:
                continue
            
            line_text = extract_text_from_line(line)
            line_text = re.sub(r'\s+', ' ', line_text).strip()
            
            if len(line_text.split()) > 6 or len(line_text) < 3:
                continue
            
            if is_likely_heading(line, prev_y, stats, page.rect.width):
                span = max(spans, key=lambda s: s["size"])
                title_candidates.append({
                    "text": line_text,
                    "size": span["size"],
                    "bold": bool(span["flags"] & 16),
                    "position": line["bbox"][1] / page.rect.height,
                    "bbox": line["bbox"]
                })
            
            prev_y = line["bbox"][3]
    
    if not title_candidates:
        largest_text = ""
        max_size = 0
        for block in blocks:
            for line in block.get("lines", []):
                if line.get("spans"):
                    span = max(line["spans"], key=lambda s: s["size"])
                    if span["size"] > max_size:
                        max_size = span["size"]
                        largest_text = extract_text_from_line(line)
        return largest_text.strip()
    
    max_size = max(c["size"] for c in title_candidates)
    for c in title_candidates:
        c["score"] = (
            (c["size"] / max_size) * 3 +
            (1.5 if c["bold"] else 0) +
            (2 if 0 <= c["position"] < 0.3 else 0) +
            (1.5 if c["text"].istitle() or c["text"].isupper() else 0)
        )
    
    best_title = max(title_candidates, key=lambda x: x["score"])
    return best_title["text"]

def cluster_font_sizes(candidates):
    if not candidates:
        return {}, []
    
    sizes = sorted({c["size"] for c in candidates}, reverse=True)
    clusters = []
    current_cluster = [sizes[0]]
    
    for size in sizes[1:]:
        if current_cluster[0] - size <= 1.0:
            current_cluster.append(size)
        else:
            clusters.append(current_cluster)
            current_cluster = [size]
    clusters.append(current_cluster)
    
    level_map = {}
    for i, cluster in enumerate(clusters[:3]):
        level = f"H{i+1}"
        for size in cluster:
            level_map[size] = level
    
    sorted_candidates = sorted(candidates, key=lambda x: (x["page"], x["bbox"][1]))
    return level_map, sorted_candidates

def extract_headings(doc):
    headings = []
    title = ""
    seen_headings = set()
    
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        blocks = page.get_text("dict")["blocks"]
        all_lines = []
        
        for block in blocks:
            for line in block.get("lines", []):
                all_lines.append(line)
        
        if not all_lines:
            continue
        
        stats = get_page_font_stats(all_lines)
        all_lines.sort(key=lambda line: line["bbox"][1])
        prev_y = None
        
        if page_num == 0:
            title = extract_title(page)
        
        for line in all_lines:
            spans = line.get("spans", [])
            if not spans:
                continue
            
            line_text = extract_text_from_line(line)
            line_text = re.sub(r'\s+', ' ', line_text).strip()
            if not line_text:
                continue
            
            if page_num == 0 and line_text.lower() == title.lower():
                continue
            
            if is_likely_heading(line, prev_y, stats, page.rect.width):
                font_size = max(span["size"] for span in spans)
                bbox = line["bbox"]
                
                norm_text = re.sub(r'\W+', '', line_text).lower()
                if norm_text in seen_headings:
                    continue
                seen_headings.add(norm_text)
                
                headings.append({
                    "text": line_text,
                    "size": font_size,
                    "page": page_num,
                    "bbox": bbox
                })
            
            prev_y = line["bbox"][3]
    
    level_map, sorted_headings = cluster_font_sizes(headings)
    
    outline = []
    for h in sorted_headings:
        level = level_map.get(h["size"])
        if level:
            outline.append({
                "level": level,
                "text": h["text"],
                "page": h["page"] + 1
            })
    
    return title, outline

@app.get("/")
def read_root():
    return {"message": "PDF Heading Extractor API", "status": "running"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

@app.post("/api/extract-headings")
async def extract_headings_api(file: UploadFile = File(...)):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        start_time = time.time()
        doc = fitz.open(tmp_path)
        title, outline = extract_headings(doc)
        doc.close()
        
        os.unlink(tmp_path)
        
        processing_time = time.time() - start_time
        
        return {
            "success": True,
            "filename": file.filename,
            "title": title,
            "outline": outline,
            "processing_time": round(processing_time, 3),
            "total_headings": len(outline)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

# Vercel serverless handler
handler = Mangum(app)
