# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from rest_framework import status

from plane.db.models import (
    Page,
    Project,
    ProjectMember,
    ProjectPage,
)


def _list_pages_url(workspace_slug: str, project_id) -> str:
    return f"/api/workspaces/{workspace_slug}/projects/{project_id}/pages/"


def _make_page(workspace, project, owner, *, name: str, parent: Page = None) -> Page:
    page = Page.objects.create(
        workspace=workspace,
        owned_by=owner,
        name=name,
        access=0,
        parent=parent,
    )
    ProjectPage.objects.create(
        workspace=workspace,
        project=project,
        page=page,
        created_by=owner,
        updated_by=owner,
    )
    return page


@pytest.mark.contract
class TestProjectPagesIncludeChildren:
    """
    Fork: the list endpoint defaults to roots-only (upstream behavior) but supports
    `?include_children=true` so the client can pull the full page tree in one request.
    """

    @pytest.mark.django_db
    def test_default_lists_only_root_pages(self, session_client, workspace, create_user):
        project = Project.objects.create(name="Pages Project", identifier="PP", workspace=workspace)
        ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)

        root_page = _make_page(workspace, project, create_user, name="Root")
        _make_page(workspace, project, create_user, name="Child", parent=root_page)

        response = session_client.get(_list_pages_url(workspace.slug, project.id))

        assert response.status_code == status.HTTP_200_OK
        returned_ids = {str(p["id"]) for p in response.json()}
        assert str(root_page.id) in returned_ids
        # Only one page comes back: the root. The child is filtered server-side.
        assert len(returned_ids) == 1

    @pytest.mark.django_db
    def test_include_children_lists_full_tree(self, session_client, workspace, create_user):
        project = Project.objects.create(name="Pages Project", identifier="PP", workspace=workspace)
        ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)

        root_page = _make_page(workspace, project, create_user, name="Root")
        child_page = _make_page(workspace, project, create_user, name="Child", parent=root_page)
        grandchild_page = _make_page(workspace, project, create_user, name="Grandchild", parent=child_page)

        response = session_client.get(
            _list_pages_url(workspace.slug, project.id), {"include_children": "true"}
        )

        assert response.status_code == status.HTTP_200_OK
        returned_ids = {str(p["id"]) for p in response.json()}
        assert {str(root_page.id), str(child_page.id), str(grandchild_page.id)}.issubset(returned_ids)

        # Verify each child carries its parent reference so the client can build the tree.
        by_id = {str(p["id"]): p for p in response.json()}
        assert by_id[str(child_page.id)]["parent"] == str(root_page.id)
        assert by_id[str(grandchild_page.id)]["parent"] == str(child_page.id)
        assert by_id[str(root_page.id)]["parent"] is None
