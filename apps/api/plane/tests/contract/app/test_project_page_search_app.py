# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

import pytest
from rest_framework import status

from plane.db.models import (
    Page,
    Project,
    ProjectMember,
    ProjectPage,
)


def _search_url(workspace_slug: str, project_id) -> str:
    return f"/api/workspaces/{workspace_slug}/projects/{project_id}/pages/search/"


def _make_page(
    workspace,
    project,
    owner,
    *,
    name: str,
    parent: Page = None,
    access: int = 0,
    body_text: str = "",
) -> Page:
    # Page.save() derives description_stripped from description_html — the body must go
    # in as HTML for the stripped text (what search matches on) to be populated.
    page = Page.objects.create(
        workspace=workspace,
        owned_by=owner,
        name=name,
        access=access,
        parent=parent,
        description_html=f"<p>{body_text}</p>" if body_text else "<p></p>",
    )
    ProjectPage.objects.create(
        workspace=workspace,
        project=project,
        page=page,
        created_by=owner,
        updated_by=owner,
    )
    return page


def _make_project(workspace, user, identifier="PS") -> Project:
    # Project names are unique per workspace — derive from the identifier so a test can
    # create several projects (and reruns against a reused DB stay clean).
    project = Project.objects.create(
        name=f"Search Project {uuid.uuid4().hex[:8]}", identifier=identifier, workspace=workspace
    )
    ProjectMember.objects.create(project=project, member=user, role=20, is_active=True)
    return project


@pytest.mark.contract
class TestProjectPageSearch:
    """
    Fork: /pages/search/ matches page titles AND body text (description_stripped),
    including sub-pages, and returns a snippet around the first body match.
    """

    @pytest.mark.django_db
    def test_matches_title(self, session_client, workspace, create_user):
        project = _make_project(workspace, create_user)
        page = _make_page(workspace, project, create_user, name="Meeting notes")
        _make_page(workspace, project, create_user, name="Unrelated")

        response = session_client.get(_search_url(workspace.slug, project.id), {"query": "meeting"})

        assert response.status_code == status.HTTP_200_OK
        results = response.json()
        assert [r["id"] for r in results] == [str(page.id)]
        # Title-only match carries no body snippet.
        assert results[0]["snippet"] is None

    @pytest.mark.django_db
    def test_matches_body_text_with_snippet(self, session_client, workspace, create_user):
        project = _make_project(workspace, create_user)
        body = "This page talks at length about the quarterly roadmap and future plans." * 3
        page = _make_page(workspace, project, create_user, name="Untitled", body_text=body)

        response = session_client.get(_search_url(workspace.slug, project.id), {"query": "quarterly roadmap"})

        assert response.status_code == status.HTTP_200_OK
        results = response.json()
        assert [r["id"] for r in results] == [str(page.id)]
        assert "quarterly roadmap" in results[0]["snippet"]

    @pytest.mark.django_db
    def test_matches_sub_pages(self, session_client, workspace, create_user):
        project = _make_project(workspace, create_user)
        root = _make_page(workspace, project, create_user, name="Root")
        child = _make_page(workspace, project, create_user, name="Deep dive", parent=root)

        response = session_client.get(_search_url(workspace.slug, project.id), {"query": "deep dive"})

        assert response.status_code == status.HTTP_200_OK
        results = response.json()
        assert [r["id"] for r in results] == [str(child.id)]
        assert results[0]["parent"] == str(root.id)

    @pytest.mark.django_db
    def test_empty_query_returns_nothing(self, session_client, workspace, create_user):
        project = _make_project(workspace, create_user)
        _make_page(workspace, project, create_user, name="Anything")

        response = session_client.get(_search_url(workspace.slug, project.id), {"query": "  "})

        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []

    @pytest.mark.django_db
    def test_excludes_other_users_private_pages(self, session_client, workspace, create_user, django_user_model):
        project = _make_project(workspace, create_user)
        other_user = django_user_model.objects.create(email="other@plane.so", username="other")
        ProjectMember.objects.create(project=project, member=other_user, role=20, is_active=True)

        mine = _make_page(workspace, project, create_user, name="Secret plan", access=1)
        _make_page(workspace, project, other_user, name="Secret diary", access=1)

        response = session_client.get(_search_url(workspace.slug, project.id), {"query": "secret"})

        assert response.status_code == status.HTTP_200_OK
        assert [r["id"] for r in response.json()] == [str(mine.id)]

    @pytest.mark.django_db
    def test_scoped_to_url_project(self, session_client, workspace, create_user):
        project = _make_project(workspace, create_user, identifier="PA")
        other_project = _make_project(workspace, create_user, identifier="PB")
        _make_page(workspace, other_project, create_user, name="Elsewhere note")

        response = session_client.get(_search_url(workspace.slug, project.id), {"query": "elsewhere"})

        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []

    @pytest.mark.django_db
    def test_non_member_is_denied(self, session_client, workspace, create_user, django_user_model):
        # A project the session user is NOT a member of.
        outsider_owner = django_user_model.objects.create(email="owner@plane.so", username="owner")
        project = Project.objects.create(name="Closed Project", identifier="CP", workspace=workspace)
        ProjectMember.objects.create(project=project, member=outsider_owner, role=20, is_active=True)

        response = session_client.get(_search_url(workspace.slug, project.id), {"query": "anything"})

        assert response.status_code == status.HTTP_403_FORBIDDEN
