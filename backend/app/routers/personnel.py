"""인적 관리 API 라우터"""

import os
import shutil
from datetime import date
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.personnel import Certification, Personnel, ProjectHistory
from app.schemas.personnel import (
    CertificationResponse,
    PersonnelCreate,
    PersonnelDetail,
    PersonnelListResponse,
    PersonnelSummary,
    PersonnelUpdate,
    ProjectHistoryCreate,
    ProjectHistoryResponse,
    ProjectHistoryUpdate,
)

router = APIRouter()


def _get_personnel_or_404(db: Session, personnel_id: int) -> Personnel:
    person = db.query(Personnel).filter(Personnel.id == personnel_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="인력을 찾을 수 없습니다.")
    return person


@router.get("/", response_model=PersonnelListResponse)
async def list_personnel(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Personnel)
    if search:
        query = query.filter(Personnel.name.contains(search))
    if department:
        query = query.filter(Personnel.department == department)
    total = query.count()
    items = query.order_by(Personnel.name).offset((page - 1) * size).limit(size).all()
    summaries = []
    for p in items:
        summaries.append(PersonnelSummary(
            id=p.id,
            name=p.name,
            title=p.title,
            department=p.department,
            years_of_experience=p.years_of_experience,
            certification_count=len(p.certifications) if p.certifications else 0,
            project_count=len(p.project_history) if p.project_history else 0,
        ))
    return PersonnelListResponse(items=summaries, total=total, page=page, size=size)


@router.post("/", response_model=PersonnelDetail, status_code=201)
async def create_personnel(data: PersonnelCreate, db: Session = Depends(get_db)):
    person = Personnel(**data.model_dump())
    db.add(person)
    db.commit()
    db.refresh(person)
    return person


@router.get("/{personnel_id}", response_model=PersonnelDetail)
async def get_personnel(personnel_id: int, db: Session = Depends(get_db)):
    return _get_personnel_or_404(db, personnel_id)


@router.put("/{personnel_id}", response_model=PersonnelDetail)
async def update_personnel(
    personnel_id: int, data: PersonnelUpdate, db: Session = Depends(get_db)
):
    person = _get_personnel_or_404(db, personnel_id)
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(person, key, value)
    db.commit()
    db.refresh(person)
    return person


@router.delete("/{personnel_id}", status_code=204)
async def delete_personnel(personnel_id: int, db: Session = Depends(get_db)):
    person = _get_personnel_or_404(db, personnel_id)
    db.delete(person)
    db.commit()
    return None


@router.post("/{personnel_id}/certifications", response_model=CertificationResponse, status_code=201)
async def add_certification(
    personnel_id: int,
    cert_name: str = Form(...),
    cert_number: Optional[str] = Form(None),
    cert_date: Optional[date] = Form(None),
    cert_issuer: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    _get_personnel_or_404(db, personnel_id)
    cert = Certification(
        personnel_id=personnel_id,
        cert_name=cert_name,
        cert_number=cert_number,
        cert_date=cert_date,
        cert_issuer=cert_issuer,
    )
    if file and file.filename:
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="파일 크기가 제한을 초과합니다. (최대 10MB)",
            )
        upload_dir = Path(settings.UPLOAD_DIR) / "certifications" / str(personnel_id)
        upload_dir.mkdir(parents=True, exist_ok=True)
        file_path = upload_dir / file.filename
        with open(file_path, "wb") as f:
            f.write(content)
        cert.cert_file_path = str(file_path)
    db.add(cert)
    db.commit()
    db.refresh(cert)
    result = CertificationResponse.model_validate(cert)
    result.has_file = cert.cert_file_path is not None
    return result


@router.get("/{personnel_id}/certifications", response_model=list[CertificationResponse])
async def list_certifications(personnel_id: int, db: Session = Depends(get_db)):
    _get_personnel_or_404(db, personnel_id)
    certs = db.query(Certification).filter(Certification.personnel_id == personnel_id).all()
    results = []
    for c in certs:
        r = CertificationResponse.model_validate(c)
        r.has_file = c.cert_file_path is not None
        results.append(r)
    return results


@router.delete("/{personnel_id}/certifications/{cert_id}", status_code=204)
async def delete_certification(
    personnel_id: int, cert_id: int, db: Session = Depends(get_db)
):
    _get_personnel_or_404(db, personnel_id)
    cert = (
        db.query(Certification)
        .filter(Certification.id == cert_id, Certification.personnel_id == personnel_id)
        .first()
    )
    if not cert:
        raise HTTPException(status_code=404, detail="자격증을 찾을 수 없습니다.")
    if cert.cert_file_path and os.path.exists(cert.cert_file_path):
        os.remove(cert.cert_file_path)
    db.delete(cert)
    db.commit()
    return None


@router.get("/{personnel_id}/certifications/{cert_id}/file")
async def download_certification_file(
    personnel_id: int, cert_id: int, db: Session = Depends(get_db)
):
    _get_personnel_or_404(db, personnel_id)
    cert = (
        db.query(Certification)
        .filter(Certification.id == cert_id, Certification.personnel_id == personnel_id)
        .first()
    )
    if not cert:
        raise HTTPException(status_code=404, detail="자격증을 찾을 수 없습니다.")
    if not cert.cert_file_path or not os.path.exists(cert.cert_file_path):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(cert.cert_file_path)


@router.post("/{personnel_id}/projects", response_model=ProjectHistoryResponse, status_code=201)
async def add_project_history(
    personnel_id: int, data: ProjectHistoryCreate, db: Session = Depends(get_db)
):
    _get_personnel_or_404(db, personnel_id)
    project = ProjectHistory(personnel_id=personnel_id, **data.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{personnel_id}/projects", response_model=list[ProjectHistoryResponse])
async def list_project_history(personnel_id: int, db: Session = Depends(get_db)):
    _get_personnel_or_404(db, personnel_id)
    return (
        db.query(ProjectHistory)
        .filter(ProjectHistory.personnel_id == personnel_id)
        .order_by(ProjectHistory.start_date.desc())
        .all()
    )


@router.put("/{personnel_id}/projects/{project_id}", response_model=ProjectHistoryResponse)
async def update_project_history(
    personnel_id: int,
    project_id: int,
    data: ProjectHistoryUpdate,
    db: Session = Depends(get_db),
):
    _get_personnel_or_404(db, personnel_id)
    project = (
        db.query(ProjectHistory)
        .filter(ProjectHistory.id == project_id, ProjectHistory.personnel_id == personnel_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트 이력을 찾을 수 없습니다.")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{personnel_id}/projects/{project_id}", status_code=204)
async def delete_project_history(
    personnel_id: int, project_id: int, db: Session = Depends(get_db)
):
    _get_personnel_or_404(db, personnel_id)
    project = (
        db.query(ProjectHistory)
        .filter(ProjectHistory.id == project_id, ProjectHistory.personnel_id == personnel_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트 이력을 찾을 수 없습니다.")
    db.delete(project)
    db.commit()
    return None
